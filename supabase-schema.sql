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
  CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
  CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
  CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

  -- Playlists: Public read & mutation access
  DROP POLICY IF EXISTS "Playlists Public Access" ON public.playlists;
  DROP POLICY IF EXISTS "playlists_all" ON public.playlists;
  CREATE POLICY "playlists_all" ON public.playlists FOR ALL USING (true) WITH CHECK (true);

  -- Tracks: Public read & mutation access
  DROP POLICY IF EXISTS "Tracks Public Access" ON public.tracks;
  DROP POLICY IF EXISTS "tracks_all" ON public.tracks;
  CREATE POLICY "tracks_all" ON public.tracks FOR ALL USING (true) WITH CHECK (true);

  -- Playlist Tracks: Public read & mutation access
  DROP POLICY IF EXISTS "Playlist Tracks Public Access" ON public.playlist_tracks;
  DROP POLICY IF EXISTS "playlist_tracks_all" ON public.playlist_tracks;
  CREATE POLICY "playlist_tracks_all" ON public.playlist_tracks FOR ALL USING (true) WITH CHECK (true);

  -- Stars: Public read & mutation access
  DROP POLICY IF EXISTS "Stars Public Access" ON public.stars;
  DROP POLICY IF EXISTS "stars_all" ON public.stars;
  CREATE POLICY "stars_all" ON public.stars FOR ALL USING (true) WITH CHECK (true);

  -- Listen Together Rooms
  DROP POLICY IF EXISTS "Rooms Public Access" ON public.listen_together_rooms;
  DROP POLICY IF EXISTS "rooms_all" ON public.listen_together_rooms;
  CREATE POLICY "rooms_all" ON public.listen_together_rooms FOR ALL USING (true) WITH CHECK (true);

  -- Listen Together Requests
  DROP POLICY IF EXISTS "Requests Public Access" ON public.listen_together_requests;
  DROP POLICY IF EXISTS "requests_all" ON public.listen_together_requests;
  CREATE POLICY "requests_all" ON public.listen_together_requests FOR ALL USING (true) WITH CHECK (true);

  -- Backgrounds
  DROP POLICY IF EXISTS "Backgrounds Public Access" ON public.backgrounds;
  DROP POLICY IF EXISTS "backgrounds_all" ON public.backgrounds;
  CREATE POLICY "backgrounds_all" ON public.backgrounds FOR ALL USING (true) WITH CHECK (true);

  -- Friendships: Authenticated social relationships
  DROP POLICY IF EXISTS "Friendships Public Access" ON public.friendships;
  DROP POLICY IF EXISTS "friendships_select" ON public.friendships;
  DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
  DROP POLICY IF EXISTS "friendships_delete" ON public.friendships;
  CREATE POLICY "friendships_select" ON public.friendships FOR SELECT USING (true);
  CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT WITH CHECK (LOWER(user1) != LOWER(user2));
  CREATE POLICY "friendships_delete" ON public.friendships FOR DELETE USING (true);

  -- Friend Requests: Managed inbox/outbox
  DROP POLICY IF EXISTS "Friend Requests Public Access" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_select" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_insert" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
  DROP POLICY IF EXISTS "friend_requests_delete" ON public.friend_requests;
  CREATE POLICY "friend_requests_select" ON public.friend_requests FOR SELECT USING (true);
  CREATE POLICY "friend_requests_insert" ON public.friend_requests FOR INSERT WITH CHECK (LOWER(from_username) != LOWER(to_username));
  CREATE POLICY "friend_requests_update" ON public.friend_requests FOR UPDATE USING (true) WITH CHECK (status IN ('pending', 'accepted', 'declined'));
  CREATE POLICY "friend_requests_delete" ON public.friend_requests FOR DELETE USING (true);
END $$;
