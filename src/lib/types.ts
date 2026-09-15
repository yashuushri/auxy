export type LoopMode = "off" | "one" | "all";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  previewUrl?: string;
  youtubeId?: string;
  url?: string;
};

export type Playlist = {
  id: string;
  name: string;
  cover?: string;
  trackIds: string[];
};

export type Background = {
  kind: "preset" | "color" | "url" | "upload" | "video";
  value: string;
};

export type UserAccount = {
  username: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  avatar: string;
  background: Background;
  playlists: Playlist[];
  library: Track[];
  volume: number;
  createdAt: number;
};

export type RoomProfile = {
  displayName: string;
  avatar: string;
  background: Background;
  playlists: Playlist[];
  library: Track[];
  volume: number;
  createdAt: number;
};
