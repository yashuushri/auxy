-- ==========================================================
-- Auxy Database Schema for Supabase PostgreSQL
-- ==========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users table (synced with Supabase Auth via Discord)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique,
  username text unique not null,
  display_name text not null default '',
  avatar_url text default '',
  bio text default '',
  background jsonb not null default '{"kind":"preset","value":"#0b0b12"}'::jsonb,
  volume integer not null default 80 check (volume >= 0 and volume <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Playlists table
create table if not exists public.playlists (
  id text primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text default '',
  cover_url text,
  is_public boolean not null default true,
  type text not null default 'native', -- 'native' or 'youtube'
  youtube_playlist_id text, -- for YouTube-linked playlists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Normalized Tracks table (reusable across playlists, stores no audio/video files)
create table if not exists public.tracks (
  id text primary key, -- e.g. yt_<youtube_id>
  youtube_id text unique not null,
  title text not null,
  artist text not null default 'Unknown Artist',
  duration integer not null default 0,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

-- 4. Playlist Tracks relationship table (preserves YouTube import order)
create table if not exists public.playlist_tracks (
  id text primary key, -- composite or uuid e.g. pl_id:track_id
  playlist_id text not null references public.playlists(id) on delete cascade,
  track_id text not null references public.tracks(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, track_id)
);

-- 5. Stars table (Account-to-account star relationship)
create table if not exists public.stars (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  starred_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, starred_user_id)
);

-- Indexes for fast queries
create index if not exists idx_users_username on public.users(lower(username));
create index if not exists idx_playlists_owner on public.playlists(owner_id);
create index if not exists idx_playlist_tracks_playlist on public.playlist_tracks(playlist_id, position);
create index if not exists idx_stars_user on public.stars(user_id);
create index if not exists idx_stars_starred on public.stars(starred_user_id);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

alter table public.users enable row level security;
alter table public.playlists enable row level security;
alter table public.tracks enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.stars enable row level security;

-- USERS policies:
-- Anyone can view public user profiles
create policy "Users are publicly viewable"
  on public.users for select
  using (true);

-- Authenticated users can insert their own profile
create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- PLAYLISTS policies:
-- Public playlists are viewable by anyone; private playlists are viewable only by owner
create policy "Public playlists are viewable by anyone"
  on public.playlists for select
  using (is_public = true or auth.uid() = owner_id);

-- Playlist owners can create playlists
create policy "Users can create playlists"
  on public.playlists for insert
  with check (auth.uid() = owner_id);

-- Playlist owners can update their own playlists
create policy "Users can update own playlists"
  on public.playlists for update
  using (auth.uid() = owner_id);

-- Playlist owners can delete their own playlists
create policy "Users can delete own playlists"
  on public.playlists for delete
  using (auth.uid() = owner_id);

-- TRACKS policies:
-- Tracks are globally readable by anyone
create policy "Tracks are readable by everyone"
  on public.tracks for select
  using (true);

-- Authenticated users can insert tracks
create policy "Authenticated users can insert tracks"
  on public.tracks for insert
  with check (auth.role() = 'authenticated');

-- PLAYLIST_TRACKS policies:
-- Viewable if the parent playlist is viewable
create policy "Playlist tracks are viewable if playlist is viewable"
  on public.playlist_tracks for select
  using (
    exists (
      select 1 from public.playlists
      where public.playlists.id = playlist_tracks.playlist_id
        and (public.playlists.is_public = true or public.playlists.owner_id = auth.uid())
    )
  );

-- Playlist owners can add tracks to their playlists
create policy "Playlist owners can insert tracks"
  on public.playlist_tracks for insert
  with check (
    exists (
      select 1 from public.playlists
      where public.playlists.id = playlist_tracks.playlist_id
        and public.playlists.owner_id = auth.uid()
    )
  );

-- Playlist owners can update positions
create policy "Playlist owners can update tracks"
  on public.playlist_tracks for update
  using (
    exists (
      select 1 from public.playlists
      where public.playlists.id = playlist_tracks.playlist_id
        and public.playlists.owner_id = auth.uid()
    )
  );

-- Playlist owners can remove tracks from their playlists
create policy "Playlist owners can delete tracks"
  on public.playlist_tracks for delete
  using (
    exists (
      select 1 from public.playlists
      where public.playlists.id = playlist_tracks.playlist_id
        and public.playlists.owner_id = auth.uid()
    )
  );

-- STARS policies:
-- Stars are viewable by everyone
create policy "Stars are viewable by everyone"
  on public.stars for select
  using (true);

-- Authenticated users can star other users
create policy "Users can star accounts"
  on public.stars for insert
  with check (auth.uid() = user_id and auth.uid() != starred_user_id);

-- Users can delete their own stars
create policy "Users can unstar accounts"
  on public.stars for delete
  using (auth.uid() = user_id);
