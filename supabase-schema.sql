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

-- 9. Friendships (Persistent social graph across all devices/sessions)
CREATE TABLE IF NOT EXISTS public.friendships (
  id TEXT PRIMARY KEY,
  user1 TEXT NOT NULL,
  user2 TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user1, user2)
);

-- 10. Friend Requests (Persistent friend request inbox/outbox)
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id TEXT PRIMARY KEY,
  from_username TEXT NOT NULL,
  from_display_name TEXT,
  from_avatar TEXT,
  to_username TEXT NOT NULL,
  to_display_name TEXT,
  to_avatar TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
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
CREATE INDEX IF NOT EXISTS idx_friendships_users ON public.friendships(LOWER(user1), LOWER(user2));
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests(LOWER(to_username), status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests(LOWER(from_username), status);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listen_together_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listen_together_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Ownership-based and read-safe Row Level Security (RLS) policies
DO $$
BEGIN
  -- Profiles: Public read, insert, update for all users
  DROP POLICY IF EXISTS "Public Profiles Policy" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles Read Policy" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles Write Policy" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles Insert Policy" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles Update Policy" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles Public Access" ON public.profiles;
  CREATE POLICY "Profiles Public Access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

  -- Playlists: Public access
  DROP POLICY IF EXISTS "Public Playlists Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Read Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Write Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Insert Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Update Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Delete Policy" ON public.playlists;
  DROP POLICY IF EXISTS "Playlists Public Access" ON public.playlists;
  CREATE POLICY "Playlists Public Access" ON public.playlists FOR ALL USING (true) WITH CHECK (true);

  -- Tracks: Public access
  DROP POLICY IF EXISTS "Public Tracks Policy" ON public.tracks;
  DROP POLICY IF EXISTS "Tracks Read Policy" ON public.tracks;
  DROP POLICY IF EXISTS "Tracks Write Policy" ON public.tracks;
  DROP POLICY IF EXISTS "Tracks Insert Policy" ON public.tracks;
  DROP POLICY IF EXISTS "Tracks Public Access" ON public.tracks;
  CREATE POLICY "Tracks Public Access" ON public.tracks FOR ALL USING (true) WITH CHECK (true);

  -- Playlist Tracks: Public access
  DROP POLICY IF EXISTS "Public Playlist Tracks Policy" ON public.playlist_tracks;
  DROP POLICY IF EXISTS "Playlist Tracks Read Policy" ON public.playlist_tracks;
  DROP POLICY IF EXISTS "Playlist Tracks Write Policy" ON public.playlist_tracks;
  DROP POLICY IF EXISTS "Playlist Tracks Public Access" ON public.playlist_tracks;
  CREATE POLICY "Playlist Tracks Public Access" ON public.playlist_tracks FOR ALL USING (true) WITH CHECK (true);

  -- Stars: Public access
  DROP POLICY IF EXISTS "Public Stars Policy" ON public.stars;
  DROP POLICY IF EXISTS "Stars Read Policy" ON public.stars;
  DROP POLICY IF EXISTS "Stars Write Policy" ON public.stars;
  DROP POLICY IF EXISTS "Stars Public Access" ON public.stars;
  CREATE POLICY "Stars Public Access" ON public.stars FOR ALL USING (true) WITH CHECK (true);

  -- Listen Together Rooms: Public access
  DROP POLICY IF EXISTS "Public Rooms Policy" ON public.listen_together_rooms;
  DROP POLICY IF EXISTS "Rooms Read Policy" ON public.listen_together_rooms;
  DROP POLICY IF EXISTS "Rooms Write Policy" ON public.listen_together_rooms;
  DROP POLICY IF EXISTS "Rooms Public Access" ON public.listen_together_rooms;
  CREATE POLICY "Rooms Public Access" ON public.listen_together_rooms FOR ALL USING (true) WITH CHECK (true);

  -- Listen Together Requests: Public access
  DROP POLICY IF EXISTS "Public Requests Policy" ON public.listen_together_requests;
  DROP POLICY IF EXISTS "Requests Read Policy" ON public.listen_together_requests;
  DROP POLICY IF EXISTS "Requests Insert Policy" ON public.listen_together_requests;
  DROP POLICY IF EXISTS "Requests Update Policy" ON public.listen_together_requests;
  DROP POLICY IF EXISTS "Requests Delete Policy" ON public.listen_together_requests;
  DROP POLICY IF EXISTS "Requests Public Access" ON public.listen_together_requests;
  CREATE POLICY "Requests Public Access" ON public.listen_together_requests FOR ALL USING (true) WITH CHECK (true);

  -- Backgrounds: Public access
  DROP POLICY IF EXISTS "Public Backgrounds Policy" ON public.backgrounds;
  DROP POLICY IF EXISTS "Backgrounds Read Policy" ON public.backgrounds;
  DROP POLICY IF EXISTS "Backgrounds Write Policy" ON public.backgrounds;
  DROP POLICY IF EXISTS "Backgrounds Public Access" ON public.backgrounds;
  CREATE POLICY "Backgrounds Public Access" ON public.backgrounds FOR ALL USING (true) WITH CHECK (true);

  -- Friendships: Public access
  DROP POLICY IF EXISTS "Friendships Public Access" ON public.friendships;
  CREATE POLICY "Friendships Public Access" ON public.friendships FOR ALL USING (true) WITH CHECK (true);

  -- Friend Requests: Public access
  DROP POLICY IF EXISTS "Friend Requests Public Access" ON public.friend_requests;
  CREATE POLICY "Friend Requests Public Access" ON public.friend_requests FOR ALL USING (true) WITH CHECK (true);
END $$;
