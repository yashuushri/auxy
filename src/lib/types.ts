export type LoopMode = "off" | "one" | "all";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover: string;
  duration: number;
  previewUrl?: string;
  youtubeId?: string;
  url?: string;
  provider?: "youtube";
  providerId?: string;
  sourceUrl?: string;
};

export type Playlist = {
  id: string;
  name: string;
  cover?: string;
  description?: string;
  isPublic?: boolean;
  type?: "native" | "youtube";
  youtubePlaylistId?: string;
  trackIds: string[];
};

export type PlaybackState = {
  title: string;
  youtubeId: string;
  playlistId: string | null;
  startedAt: number;
  duration: number;
  paused: boolean;
  currentTime: number;
};

export type Background = {
  kind: "preset" | "color" | "url" | "upload" | "video";
  value: string;
};

export type UserAccount = {
  id?: string;
  discordId?: string;
  username: string;
  displayName: string;
  email?: string;
  emailVerified?: boolean;
  password?: string;
  avatar: string;
  bio?: string;
  background: Background;
  playlists: Playlist[];
  library: Track[];
  volume: number;
  createdAt: number;
};

export type RoomProfile = {
  displayName: string;
  avatar: string;
  bio?: string;
  background: Background;
  playlists: Playlist[];
  library: Track[];
  volume: number;
  createdAt: number;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  background?: Background;
  starCount: number;
  isStarred: boolean;
  playlists: {
    id: string;
    name: string;
    description?: string;
    cover?: string;
    trackCount: number;
    type?: "native" | "youtube";
    youtubePlaylistId?: string;
    tracks: Track[];
  }[];
};

