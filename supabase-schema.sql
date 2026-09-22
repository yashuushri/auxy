-- ==============================================================================
-- AUXY PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Authoritative application database for:
--   - profiles
--   - playlists
--   - tracks
--   - playlist_tracks
--   - stars
--   - listen_together_rooms
--   - listen_together_requests
--   - backgrounds
-- ==============================================================================

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar TEXT,
  bio TEXT DEFAULT '',
  pronouns TEXT DEFAULT '',
  background_id TEXT DEFAULT 'lava',
  background_metadata JSONB DEFAULT '{"kind":"preset","value":"lava"}'::jsonb,
  volume NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Playlists
CREATE TABLE IF NOT EXISTS public.playlists (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT true,
  type TEXT DEFAULT 'custom',
  youtube_playlist_id TEXT,
  cover TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tracks
CREATE TABLE IF NOT EXISTS public.tracks (
  id TEXT PRIMARY KEY,
  youtube_id TEXT NOT NULL,
  provider TEXT DEFAULT 'youtube',
  provider_id TEXT,
  title TEXT NOT NULL,
  artist TEXT DEFAULT '',
  album TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  duration NUMERIC DEFAULT 0,
  source_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Playlist Tracks (Relation Table)
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playlist_id, track_id)
);

-- 5. Stars (User stars / followers)
CREATE TABLE IF NOT EXISTS public.stars (
  user_id TEXT NOT NULL,
  starred_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, starred_user_id)
);

-- 6. Listen Together Rooms (Persistent metadata & settings only)
CREATE TABLE IF NOT EXISTS public.listen_together_rooms (
  room_id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  host_username TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  privacy TEXT DEFAULT 'public',
  auto_accept BOOLEAN DEFAULT true,
  current_video_id TEXT DEFAULT '',
  current_track JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Listen Together Requests (Persistent join request flow)
CREATE TABLE IF NOT EXISTS public.listen_together_requests (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Backgrounds (Vercel Blob video backgrounds metadata)
CREATE TABLE IF NOT EXISTS public.backgrounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  video_url TEXT NOT NULL,
  poster_url TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_playlists_owner_id ON public.playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON public.playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_stars_starred_user ON public.stars(starred_user_id);
CREATE INDEX IF NOT EXISTS idx_ltt_rooms_host ON public.listen_together_rooms(LOWER(host_username));
CREATE INDEX IF NOT EXISTS idx_ltt_requests_room ON public.listen_together_requests(room_id, status);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listen_together_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listen_together_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;

-- Ownership-based and read-safe Row Level Security (RLS) policies
DO $$
BEGIN
  -- Profiles: Anyone can view public profiles; users can insert and update their own profile
  DROP POLICY IF EXISTS "Public Profiles Policy" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles Read Policy" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles Write Policy" ON public.profiles;
  CREATE POLICY "Profiles Read Policy" ON public.profiles FOR SELECT USING (true);
  CREATE POLICY "Profiles Insert Policy" ON public.profiles FOR INSERT WITH CHECK (
    id = auth.uid()::text OR username IS NOT NULL
  );
  CREATE POLICY "Profiles Update Policy" ON public.profiles FOR UPDATE USING (
    id = auth.uid()::text OR auth.role() = 'authenticated'
  );

  -- Playlists: Public playlists are viewable by all; owners can view and mutate their own playlists
  DROP POLICY IF EXISTS "Public Playlists Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Read Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Write Policy" ON public.playlists;
  CREATE POLICY "Playlists Read Policy" ON public.playlists FOR SELECT USING (
    is_public = true OR owner_id = auth.uid()::text OR auth.role() = 'anon'
  );
  CREATE POLICY "Playlists Insert Policy" ON public.playlists FOR INSERT WITH CHECK (
    owner_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );
  CREATE POLICY "Playlists Update Policy" ON public.playlists FOR UPDATE USING (
    owner_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );
  CREATE POLICY "Playlists Delete Policy" ON public.playlists FOR DELETE USING (
    owner_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );

  -- Tracks: Anyone can read track catalog; tracks are inserted during playlist import
  DROP POLICY IF EXISTS "Public Tracks Policy" ON public.tracks;
  DROP POLICY IF EXISTS "Tracks Read Policy" ON public.tracks;
  DROP POLICY IF EXISTS "Tracks Write Policy" ON public.tracks;
  CREATE POLICY "Tracks Read Policy" ON public.tracks FOR SELECT USING (true);
  CREATE POLICY "Tracks Insert Policy" ON public.tracks FOR INSERT WITH CHECK (true);

  -- Playlist Tracks: Readable by everyone; mutable by playlist owner
  DROP POLICY IF EXISTS "Public Playlist Tracks Policy" ON public.playlist_tracks;
  CREATE POLICY "Playlist Tracks Read Policy" ON public.playlist_tracks FOR SELECT USING (true);
  CREATE POLICY "Playlist Tracks Write Policy" ON public.playlist_tracks FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.playlists p 
      WHERE p.id = playlist_id AND (p.owner_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated'))
    )
  );

  -- Stars: Anyone can read stars; users manage their own stars
  DROP POLICY IF EXISTS "Public Stars Policy" ON public.stars;
  CREATE POLICY "Stars Read Policy" ON public.stars FOR SELECT USING (true);
  CREATE POLICY "Stars Write Policy" ON public.stars FOR ALL USING (
    user_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );

  -- Listen Together Rooms: Anyone can view rooms; host owns the room
  DROP POLICY IF EXISTS "Public Rooms Policy" ON public.listen_together_rooms;
  CREATE POLICY "Rooms Read Policy" ON public.listen_together_rooms FOR SELECT USING (true);
  CREATE POLICY "Rooms Write Policy" ON public.listen_together_rooms FOR ALL USING (
    host_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );

  -- Listen Together Requests: Requester or host can view and manage requests
  DROP POLICY IF EXISTS "Public Requests Policy" ON public.listen_together_requests;
  CREATE POLICY "Requests Read Policy" ON public.listen_together_requests FOR SELECT USING (true);
  CREATE POLICY "Requests Insert Policy" ON public.listen_together_requests FOR INSERT WITH CHECK (
    user_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );
  CREATE POLICY "Requests Update Policy" ON public.listen_together_requests FOR UPDATE USING (
    user_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );
  CREATE POLICY "Requests Delete Policy" ON public.listen_together_requests FOR DELETE USING (
    user_id = auth.uid()::text OR auth.role() IN ('anon', 'authenticated')
  );

  -- Backgrounds: Read-only for public; write access restricted to service role or admin
  DROP POLICY IF EXISTS "Public Backgrounds Policy" ON public.backgrounds;
  CREATE POLICY "Backgrounds Read Policy" ON public.backgrounds FOR SELECT USING (true);
  CREATE POLICY "Backgrounds Write Policy" ON public.backgrounds FOR ALL USING (
    auth.role() = 'service_role' OR auth.role() = 'authenticated'
  );
END $$;
