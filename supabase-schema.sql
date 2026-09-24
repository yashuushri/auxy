-- ==============================================================================
-- AUXY PRODUCTION SUPABASE POSTGRESQL SCHEMA (FINAL BETA LAUNCH)
-- Authoritative application database for:
--   - profiles
--   - playlists
--   - tracks
--   - playlist_tracks
--   - stars
--   - listen_together_rooms
--   - listen_together_requests
--   - backgrounds
--   - friendships
--   - friend_requests
-- ==============================================================================

-- 1. Profiles Table
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

-- 2. Playlists Table
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

-- 3. Tracks Table
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

-- 4. Playlist Tracks Table (Relation Table)
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playlist_id, track_id)
);

-- 5. Stars Table (User stars / followers)
CREATE TABLE IF NOT EXISTS public.stars (
  user_id TEXT NOT NULL,
  starred_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, starred_user_id)
);

-- 6. Listen Together Rooms Table
CREATE TABLE IF NOT EXISTS public.listen_together_rooms (
  room_id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  host_username TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  privacy TEXT DEFAULT 'public',
  auto_accept BOOLEAN DEFAULT true,
  current_video_id TEXT DEFAULT '',
  current_track JSONB,
  is_playing BOOLEAN DEFAULT false,
  position_seconds NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Listen Together Requests Table
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

-- 8. Backgrounds Table
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

-- 9. Friendships (Authoritative Social Graph across all Vercel instances & devices)
CREATE TABLE IF NOT EXISTS public.friendships (
  id TEXT PRIMARY KEY,
  user1 TEXT NOT NULL,
  user2 TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user1, user2)
);

-- Ensure all possible friendship columns exist even if table pre-existed
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS user1 TEXT;
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS user2 TEXT;
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS friend_id TEXT;
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 10. Friend Requests (Authoritative Request Inbox / Outbox)
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

-- Ensure all possible friend_requests columns exist even if table pre-existed
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS from_username TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS from_display_name TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS from_avatar TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS to_username TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS to_display_name TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS to_avatar TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS receiver_id TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS requester_id TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS recipient_id TEXT;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure all listen_together columns exist even if tables pre-existed
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS requester_id TEXT;
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS requester_username TEXT;
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS requester_display_name TEXT;
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS requester_avatar TEXT;
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.listen_together_requests ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Backfill from_username and to_username if sender_id / receiver_id exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'friend_requests' AND column_name = 'sender_id'
  ) THEN
    UPDATE public.friend_requests fr
    SET from_username = COALESCE(fr.from_username, p.username, fr.sender_id)
    FROM public.profiles p
    WHERE fr.sender_id = p.id AND (fr.from_username IS NULL OR fr.from_username = '');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'friend_requests' AND column_name = 'receiver_id'
  ) THEN
    UPDATE public.friend_requests fr
    SET to_username = COALESCE(fr.to_username, p.username, fr.receiver_id)
    FROM public.profiles p
    WHERE fr.receiver_id = p.id AND (fr.to_username IS NULL OR fr.to_username = '');
  END IF;
END $$;

-- ==============================================================================
-- DATABASE INDEXES FOR LIGHTNING FAST QUERIES & USER SEARCH
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(LOWER(display_name));
CREATE INDEX IF NOT EXISTS idx_playlists_owner_id ON public.playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON public.playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_stars_starred_user ON public.stars(starred_user_id);
CREATE INDEX IF NOT EXISTS idx_ltt_rooms_host ON public.listen_together_rooms(LOWER(host_username));
CREATE INDEX IF NOT EXISTS idx_ltt_requests_room ON public.listen_together_requests(room_id, status);

-- Authoritative Social Graph Indexes
CREATE INDEX IF NOT EXISTS idx_friendships_canonical ON public.friendships(LOWER(user1), LOWER(user2));
CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON public.friendships(LOWER(user1));
CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON public.friendships(LOWER(user2));
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests(LOWER(to_username), status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests(LOWER(from_username), status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

-- ==============================================================================
-- ROLE GRANTS (Ensure anon, authenticated, and service_role have full access)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
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

DO $$
BEGIN
  -- Profiles: Public read, insert/update permitted for user identity
  DROP POLICY IF EXISTS "Profiles Public Access" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
  CREATE POLICY "profiles_all" ON public.profiles FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Playlists: Public read & mutation access
  DROP POLICY IF EXISTS "Playlists Public Access" ON public.playlists;
  DROP POLICY IF EXISTS "playlists_all" ON public.playlists;
  CREATE POLICY "playlists_all" ON public.playlists FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Tracks: Public read & mutation access
  DROP POLICY IF EXISTS "Tracks Public Access" ON public.tracks;
  DROP POLICY IF EXISTS "tracks_all" ON public.tracks;
  CREATE POLICY "tracks_all" ON public.tracks FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Playlist Tracks: Public read & mutation access
  DROP POLICY IF EXISTS "Playlist Tracks Public Access" ON public.playlist_tracks;
  DROP POLICY IF EXISTS "playlist_tracks_all" ON public.playlist_tracks;
  CREATE POLICY "playlist_tracks_all" ON public.playlist_tracks FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Stars: Public read & mutation access
  DROP POLICY IF EXISTS "Stars Public Access" ON public.stars;
  DROP POLICY IF EXISTS "stars_all" ON public.stars;
  CREATE POLICY "stars_all" ON public.stars FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Listen Together Rooms
  DROP POLICY IF EXISTS "Rooms Public Access" ON public.listen_together_rooms;
  DROP POLICY IF EXISTS "rooms_all" ON public.listen_together_rooms;
  CREATE POLICY "rooms_all" ON public.listen_together_rooms FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Listen Together Requests
  DROP POLICY IF EXISTS "Requests Public Access" ON public.listen_together_requests;
  DROP POLICY IF EXISTS "requests_all" ON public.listen_together_requests;
  CREATE POLICY "requests_all" ON public.listen_together_requests FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Backgrounds
  DROP POLICY IF EXISTS "Backgrounds Public Access" ON public.backgrounds;
  DROP POLICY IF EXISTS "backgrounds_all" ON public.backgrounds;
  CREATE POLICY "backgrounds_all" ON public.backgrounds FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Friendships: Authenticated social relationships
  DROP POLICY IF EXISTS "Friendships Public Access" ON public.friendships;
  DROP POLICY IF EXISTS "friendships_select" ON public.friendships;
  DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
  DROP POLICY IF EXISTS "friendships_delete" ON public.friendships;
  DROP POLICY IF EXISTS "friendships_all" ON public.friendships;
  CREATE POLICY "friendships_all" ON public.friendships FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

  -- Friend Requests: Managed inbox/outbox
  DROP POLICY IF EXISTS "Friend Requests Public Access" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_select" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_insert" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_delete" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_all" ON public.friend_requests;
  CREATE POLICY "friend_requests_all" ON public.friend_requests FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
END $$;

-- Reload PostgREST schema cache to ensure all newly created tables and columns are immediately visible
NOTIFY pgrst, 'reload schema';

