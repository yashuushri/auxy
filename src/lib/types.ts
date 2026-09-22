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
  posterUrl?: string;
  name?: string;
  mediaType?: "photo" | "gif" | "video";
};

export type BackgroundMetadata = {
  id: string;
  name: string;
  videoUrl: string;
  posterUrl?: string;
  active: boolean;
  version?: number;
  createdAt: number;
  updatedAt: number;
};

export type StarRecord = {
  id: string;
  userId: string;
  starredUserId: string;
  createdAt: number;
};

export type RoomRequest = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};

export type Room = {
  id: string;
  name: string;
  hostId: string;
  hostUsername: string;
  hostDisplayName?: string;
  hostAvatar?: string;
  currentTrack?: Track;
  playlistTracks?: Track[];
  playlistName?: string;
  isPlaying: boolean;
  position: number;
  playlistId?: string;
  participantCount: number;
  listenTogetherEnabled?: boolean;
  privacy?: "public" | "friends";
  autoAccept?: boolean;
  stateVersion?: number;
  stateType?: "PLAY" | "PAUSE" | "SEEK" | "TRACK_CHANGE";
  background?: Background;
  createdAt: number;
  updatedAt: number;
};

export type RoomParticipant = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  joinedAt: number;
  lastSeen: number;
};

export type UserAccount = {
  id?: string;
  discordId?: string;
  username: string;
  displayName: string;
  pronouns?: string;
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
  lastActive?: number;
};

export type RoomProfile = {
  displayName: string;
  pronouns?: string;
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
  pronouns?: string;
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

export type ExploreUser = {
  id: string;
  username: string;
  displayName: string;
  pronouns?: string;
  avatar: string;
  bio?: string;
  background?: Background;
  starCount?: number;
  lastActive?: number;
  lastSeen?: number;
  isOnline?: boolean;
  isLive?: boolean;
  hasLiveRoom?: boolean;
  isPlaying?: boolean;
  currentTrack?: Track;
  listenTogetherEnabled?: boolean;
  participantCount?: number;
  roomId?: string;
};

