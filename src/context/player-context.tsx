"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { extractYouTubeId, findYoutubeId } from "@/lib/music";
import type { LoopMode, Playlist, Track } from "@/lib/types";

type PlayerContextValue = {
  tracks: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  loopMode: LoopMode;
  isShuffle: boolean;
  volume: number;
  progress: number;
  duration: number;
  activePlaylistId: string;
  playlists: Playlist[];
  library: Track[];
  playTrack: (index: number, playlistId?: string) => void;
  playTrackById: (id: string, playlistId?: string) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleLoopMode: () => void;
  toggleShuffle: () => void;
  setVolume: (value: number) => void;
  seek: (value: number) => void;
  setActivePlaylist: (id: string) => void;
  addCustomTrack: (input: { url: string; title?: string; artist?: string }) => Track | null;
  addTracks: (incoming: Track[], playlistId?: string) => void;
  moveTrack: (trackId: string, fromPlaylistId: string, toPlaylistId: string) => void;
  removeTrackFromPlaylist: (trackId: string, playlistId: string) => void;
  deleteTrack: (trackId: string) => void;
  createPlaylist: (name: string, options?: { activate?: boolean }) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  toggleLiked: (trackId: string) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function loadYoutubeApi() {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined") return resolve();
    if (window.YT?.Player) return resolve();
    const existing = document.querySelector("script[src='https://www.youtube.com/iframe_api']");
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }
    if (window.YT?.Player) resolve();
  });
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeRef = useRef<YT.Player | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activePlaylistId, setActivePlaylistId] = useState("discover");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const shuffleBag = useRef<number[]>([]);

  const playlists = user?.playlists ?? [];
  const library = user?.library ?? [];
  const volume = user?.volume ?? 80;

  const tracks = useMemo(() => {
    const playlist = playlists.find((item) => item.id === activePlaylistId) ?? playlists[0];
    if (!playlist) return library;
    const mapped = playlist.trackIds
      .map((id) => library.find((track) => track.id === id))
      .filter((track): track is Track => Boolean(track));
    return mapped;
  }, [activePlaylistId, library, playlists]);

  const currentTrack = tracks[currentIndex] ?? null;

  useEffect(() => {
    if (!tracks.length) {
      if (currentIndex !== 0) setCurrentIndex(0);
      setIsPlaying(false);
      return;
    }
    if (currentIndex >= tracks.length) setCurrentIndex(tracks.length - 1);
  }, [tracks.length, currentIndex]);

  const stopEngines = useCallback(() => {
    audioRef.current?.pause();
    try {
      youtubeRef.current?.pauseVideo();
    } catch {
      /* empty */
    }
  }, []);

  const nextIndex = useCallback(
    (from = currentIndex, fromEnded = false) => {
      if (!tracks.length) return from;
      if (isShuffle) {
        if (!shuffleBag.current.length) {
          if (fromEnded && loopMode !== "all") return from;
          const rest = tracks.map((_, index) => index).filter((index) => index !== from);
          shuffleBag.current = rest;
          for (let i = shuffleBag.current.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffleBag.current[i], shuffleBag.current[j]] = [shuffleBag.current[j], shuffleBag.current[i]];
          }
        }
        return shuffleBag.current.pop() ?? from;
      }
      if (from + 1 < tracks.length) return from + 1;
      return loopMode === "all" ? 0 : from;
    },
    [currentIndex, isShuffle, loopMode, tracks.length]
  );

  const restartCurrent = useCallback(() => {
    setProgress(0);
    setIsPlaying(true);
    const audio = audioRef.current;
    if (audio && !currentTrack?.youtubeId) {
      audio.currentTime = 0;
      void audio.play().catch(() => setIsPlaying(false));
    }
    try {
      const player = youtubeRef.current;
      if (player && currentTrack?.youtubeId) {
        player.seekTo(0, true);
        player.playVideo();
      }
    } catch {
      /* empty */
    }
  }, [currentTrack?.youtubeId]);

  const playTrack = useCallback(
    (index: number, playlistId?: string) => {
      if (playlistId) setActivePlaylistId(playlistId);
      setCurrentIndex(index);
      setIsPlaying(true);
      setProgress(0);
    },
    []
  );

  const playTrackById = useCallback(
    (id: string, playlistId?: string) => {
      const list = playlistId
        ? (playlists.find((item) => item.id === playlistId)?.trackIds ?? [])
            .map((trackId) => library.find((track) => track.id === trackId))
            .filter((track): track is Track => Boolean(track))
        : tracks;
      const index = list.findIndex((track) => track.id === id);
      if (index < 0) return;
      playTrack(index, playlistId);
    },
    [library, playlists, playTrack, tracks]
  );

  const onTrackEnded = useCallback(() => {
    if (!tracks.length) return;
    if (loopMode === "one") {
      restartCurrent();
      return;
    }
    const upcoming = nextIndex(currentIndex, true);
    if (upcoming === currentIndex) {
      if (loopMode === "off") {
        setIsPlaying(false);
        return;
      }
      restartCurrent();
      return;
    }
    setCurrentIndex(upcoming);
    setProgress(0);
    setIsPlaying(true);
  }, [currentIndex, loopMode, nextIndex, restartCurrent, tracks.length]);

  const nextTrack = useCallback(() => {
    if (!tracks.length) return;
    const upcoming = nextIndex(currentIndex, false);
    if (upcoming === currentIndex && loopMode !== "all" && !isShuffle) return;
    setCurrentIndex(upcoming);
    setProgress(0);
    setIsPlaying(true);
  }, [currentIndex, isShuffle, loopMode, nextIndex, tracks.length]);

  const prevTrack = useCallback(() => {
    if (progress > 3) {
      setProgress(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      try {
        youtubeRef.current?.seekTo(0, true);
      } catch {
        /* empty */
      }
      return;
    }
    setCurrentIndex((index) => (index - 1 + tracks.length) % Math.max(tracks.length, 1));
    setProgress(0);
    setIsPlaying(true);
  }, [progress, tracks.length]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    setIsPlaying((value) => !value);
  }, [currentTrack]);

  const toggleLoopMode = useCallback(() => {
    setLoopMode((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((value) => !value);
    shuffleBag.current = [];
  }, []);

  const setVolume = useCallback(
    (value: number) => {
      updateUser({ volume: Math.max(0, Math.min(100, value)) });
    },
    [updateUser]
  );

  const seek = useCallback((value: number) => {
    setProgress(value);
    if (audioRef.current) audioRef.current.currentTime = value;
    try {
      youtubeRef.current?.seekTo(value, true);
    } catch {
      /* empty */
    }
  }, []);

  const setActivePlaylist = useCallback((id: string) => {
    setActivePlaylistId(id);
    setCurrentIndex(0);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const attachYoutubeId = useCallback(
    (trackId: string, youtubeId: string, duration?: number) => {
      updateUser((current) => ({
        ...current,
        library: current.library.map((track) =>
          track.id === trackId
            ? {
                ...track,
                youtubeId,
                url: `https://www.youtube.com/watch?v=${youtubeId}`,
                duration: duration && duration > 0 ? Math.round(duration) : track.duration,
              }
            : track
        ),
      }));
    },
    [updateUser]
  );

  const savedDurationRef = useRef<{ id: string; duration: number } | null>(null);
  const persistDuration = useCallback(
    (trackId: string, seconds: number) => {
      const next = Math.round(seconds);
      if (!trackId || !Number.isFinite(next) || next < 1) return;
      if (savedDurationRef.current?.id === trackId && savedDurationRef.current.duration === next) return;
      savedDurationRef.current = { id: trackId, duration: next };
      updateUser((current) => {
        const existing = current.library.find((track) => track.id === trackId);
        if (!existing || existing.duration === next) return current;
        return {
          ...current,
          library: current.library.map((track) =>
            track.id === trackId ? { ...track, duration: next } : track
          ),
        };
      });
    },
    [updateUser]
  );

  const addTracks = useCallback(
    (incoming: Track[], playlistId = activePlaylistId) => {
      if (!incoming.length) return;
      updateUser((current) => {
        const libraryMap = new Map(current.library.map((track) => [track.id, track]));
        incoming.forEach((track) => libraryMap.set(track.id, track));
        const nextLibrary = Array.from(libraryMap.values());
        const targetId = current.playlists.some((playlist) => playlist.id === playlistId)
          ? playlistId
          : current.playlists[0]?.id;
        const nextPlaylists = current.playlists.map((playlist) => {
          if (playlist.id !== targetId) return playlist;
          return {
            ...playlist,
            trackIds: Array.from(new Set([...playlist.trackIds, ...incoming.map((track) => track.id)])),
            cover: incoming[0]?.cover || playlist.cover,
          };
        });
        return { ...current, library: nextLibrary, playlists: nextPlaylists };
      });
      incoming.forEach((track) => {
        if (track.youtubeId) return;
        void findYoutubeId(track.title, track.artist).then((found) => {
          if (found) attachYoutubeId(track.id, found.youtubeId, found.duration);
        });
      });
    },
    [activePlaylistId, attachYoutubeId, updateUser]
  );

  const addCustomTrack = useCallback(
    (input: { url: string; title?: string; artist?: string }) => {
      if (!user) return null;
      const youtubeId = extractYouTubeId(input.url) || undefined;
      if (!youtubeId && !input.url.trim()) return null;
      const track: Track = {
        id: youtubeId ? `yt-${youtubeId}` : `custom-${Date.now()}`,
        title: input.title?.trim() || (youtubeId ? `YouTube ${youtubeId}` : "New Track"),
        artist: input.artist?.trim() || user.displayName,
        album: "Added by you",
        cover: youtubeId
          ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
          : "https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84bab681d75d3b3488b6a30109",
        duration: 0,
        url: input.url,
        youtubeId,
      };
      addTracks([track]);
      toast.success("Song added");
      return track;
    },
    [addTracks, user]
  );

  const createPlaylist = useCallback(
    (name: string, options?: { activate?: boolean }) => {
      const playlist: Playlist = {
        id: `pl-${Date.now()}`,
        name: name.trim() || "New playlist",
        cover: undefined,
        trackIds: [],
      };
      updateUser((current) => ({ ...current, playlists: [...current.playlists, playlist] }));
      if (options?.activate !== false) setActivePlaylistId(playlist.id);
      toast.success("Playlist created");
      return playlist;
    },
    [updateUser]
  );

  const moveTrack = useCallback(
    (trackId: string, fromPlaylistId: string, toPlaylistId: string) => {
      if (!trackId || fromPlaylistId === toPlaylistId) return;
      updateUser((current) => ({
        ...current,
        playlists: current.playlists.map((playlist) => {
          if (playlist.id === fromPlaylistId) {
            return { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) };
          }
          if (playlist.id === toPlaylistId && !playlist.trackIds.includes(trackId)) {
            return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
          }
          return playlist;
        }),
      }));
    },
    [updateUser]
  );

  const removeTrackFromPlaylist = useCallback(
    (trackId: string, playlistId: string) => {
      updateUser((current) => ({
        ...current,
        playlists: current.playlists.map((playlist) =>
          playlist.id === playlistId
            ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
            : playlist
        ),
      }));
    },
    [updateUser]
  );

  const deleteTrack = useCallback(
    (trackId: string) => {
      updateUser((current) => ({
        ...current,
        library: current.library.filter((track) => track.id !== trackId),
        playlists: current.playlists.map((playlist) => ({
          ...playlist,
          trackIds: playlist.trackIds.filter((id) => id !== trackId),
        })),
      }));
    },
    [updateUser]
  );

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      updateUser((current) => ({
        ...current,
        playlists: current.playlists.map((playlist) => (playlist.id === id ? { ...playlist, name } : playlist)),
      }));
    },
    [updateUser]
  );

  const toggleLiked = useCallback(
    (trackId: string) => {
      updateUser((current) => ({
        ...current,
        playlists: current.playlists.map((playlist) => {
          if (playlist.id !== "liked") return playlist;
          const has = playlist.trackIds.includes(trackId);
          return {
            ...playlist,
            trackIds: has ? playlist.trackIds.filter((id) => id !== trackId) : [...playlist.trackIds, trackId],
          };
        }),
      }));
    },
    [updateUser]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    try {
      youtubeRef.current?.setVolume(volume);
    } catch {
      /* empty */
    }
  }, [volume]);

  const onTrackEndedRef = useRef(onTrackEnded);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  onTrackEndedRef.current = onTrackEnded;
  isPlayingRef.current = isPlaying;
  volumeRef.current = volume;

  useEffect(() => {
    const trackId = currentTrack?.id;
    const youtubeId = currentTrack?.youtubeId;
    const title = currentTrack?.title;
    const artist = currentTrack?.artist;
    if (!trackId || youtubeId || !title) {
      setResolvingId(null);
      return;
    }
    let cancelled = false;
    setResolvingId(trackId);
    void findYoutubeId(title, artist ?? "").then((found) => {
      if (cancelled) return;
      if (found) attachYoutubeId(trackId, found.youtubeId, found.duration);
      else if (isPlayingRef.current) {
        toast.message("Could not find the full song. Playing a short preview instead.");
      }
      setResolvingId((current) => (current === trackId ? null : current));
    });
    return () => {
      cancelled = true;
    };
  }, [attachYoutubeId, currentTrack?.artist, currentTrack?.id, currentTrack?.title, currentTrack?.youtubeId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const isYoutube = Boolean(currentTrack.youtubeId);

    if (!isYoutube) {
      try {
        youtubeRef.current?.pauseVideo();
      } catch {
        /* empty */
      }
      if (resolvingId === currentTrack.id) {
        stopEngines();
        return;
      }
      if (!currentTrack.previewUrl) {
        stopEngines();
        if (isPlayingRef.current) {
          toast.message("This track has no preview. Try a YouTube link.");
        }
        return;
      }
      if (audio.src !== currentTrack.previewUrl) {
        audio.src = currentTrack.previewUrl;
      }
      audio.volume = volumeRef.current / 100;
      if (isPlayingRef.current) {
        void audio.play().catch(() => setIsPlaying(false));
      } else {
        audio.pause();
      }
      return;
    }

    audio.pause();
    const videoId = currentTrack.youtubeId;
    if (!videoId) return;
    let cancelled = false;
    void loadYoutubeApi().then(() => {
      const api = window.YT;
      if (cancelled || !youtubeHostRef.current || !api) return;
      const start = () => {
        const player = youtubeRef.current;
        if (!player) return;
        player.setVolume(volumeRef.current);
        if (isPlayingRef.current) player.playVideo();
        else player.pauseVideo();
      };
      if (youtubeRef.current) {
        youtubeRef.current.loadVideoById(videoId);
        start();
        return;
      }
      youtubeRef.current = new api.Player(youtubeHostRef.current, {
        height: "180",
        width: "320",
        videoId,
        playerVars: { autoplay: isPlayingRef.current ? 1 : 0, controls: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: (event) => {
            event.target.setVolume(volumeRef.current);
            if (isPlayingRef.current) event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === api.PlayerState.ENDED) onTrackEndedRef.current();
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack, resolvingId, stopEngines]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack?.youtubeId) {
      audio.pause();
      try {
        const player = youtubeRef.current;
        if (!player) return;
        player.setVolume(volume);
        if (isPlaying) player.playVideo();
        else player.pauseVideo();
      } catch {
        /* empty */
      }
      return;
    }
    if (resolvingId === currentTrack?.id) {
      audio.pause();
      return;
    }
    audio.volume = volume / 100;
    if (isPlaying && currentTrack?.previewUrl) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying, resolvingId, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      const next = audio.duration || currentTrack?.duration || 0;
      setProgress(audio.currentTime || 0);
      setDuration(next);
      if (currentTrack?.id && next > 1) persistDuration(currentTrack.id, next);
    };
    const onEnded = () => onTrackEndedRef.current();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onTime);
    const timer = window.setInterval(() => {
      try {
        const player = youtubeRef.current;
        if (!player?.getCurrentTime || !currentTrack?.youtubeId) return;
        setProgress(player.getCurrentTime() || 0);
        const next = player.getDuration() || currentTrack.duration || 0;
        setDuration(next);
        if (next > 1) persistDuration(currentTrack.id, next);
      } catch {
        /* empty */
      }
    }, 500);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onTime);
      window.clearInterval(timer);
    };
  }, [currentTrack, persistDuration]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setProgress(0);
  }, [user?.username]);

  const value = useMemo(
    () => ({
      tracks,
      currentTrack,
      currentIndex,
      isPlaying,
      loopMode,
      isShuffle,
      volume,
      progress,
      duration,
      activePlaylistId,
      playlists,
      library,
      playTrack,
      playTrackById,
      togglePlay,
      nextTrack,
      prevTrack,
      toggleLoopMode,
      toggleShuffle,
      setVolume,
      seek,
      setActivePlaylist,
      addCustomTrack,
      addTracks,
      moveTrack,
      removeTrackFromPlaylist,
      deleteTrack,
      createPlaylist,
      renamePlaylist,
      toggleLiked,
    }),
    [
      tracks,
      currentTrack,
      currentIndex,
      isPlaying,
      loopMode,
      isShuffle,
      volume,
      progress,
      duration,
      activePlaylistId,
      playlists,
      library,
      playTrack,
      playTrackById,
      togglePlay,
      nextTrack,
      prevTrack,
      toggleLoopMode,
      toggleShuffle,
      setVolume,
      seek,
      setActivePlaylist,
      addCustomTrack,
      addTracks,
      moveTrack,
      removeTrackFromPlaylist,
      deleteTrack,
      createPlaylist,
      renamePlaylist,
      toggleLiked,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      <audio ref={audioRef} preload="metadata" />
      <div className="pointer-events-none fixed top-0 -left-[9999px] h-[180px] w-[320px] overflow-hidden opacity-0">
        <div ref={youtubeHostRef} className="h-[180px] w-[320px]" />
      </div>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}
