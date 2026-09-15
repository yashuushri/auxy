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
import {
  extractYouTubeId,
  isValidYouTubeId,
  parseYouTubeUrl,
} from "@/lib/youtube";
import type { LoopMode, PlaybackState, Playlist, Track } from "@/lib/types";

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
  playbackState: PlaybackState;
  playTrack: (index: number, playlistId?: string) => void;
  playTrackById: (id: string, playlistId?: string) => void;
  playYouTubePlaylist: (playlistId: string) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleLoopMode: () => void;
  toggleShuffle: () => void;
  setVolume: (value: number) => void;
  seek: (value: number) => void;
  setActivePlaylist: (id: string) => void;
  addCustomTrack: (input: { url: string; title?: string; artist?: string }) => Promise<Track | null>;
  saveYouTubePlaylist: (urlOrId: string, customName?: string) => Promise<Playlist | null>;
  importYouTubePlaylist: (urlOrId: string, customName?: string) => Promise<{ imported: number; unavailable: number }>;
  addTracks: (incoming: Track[], playlistId?: string) => void;
  moveTrack: (trackId: string, fromPlaylistId: string, toPlaylistId: string) => void;
  removeTrackFromPlaylist: (trackId: string, playlistId: string) => void;
  deleteTrack: (trackId: string) => void;
  createPlaylist: (name: string, options?: { activate?: boolean; isPublic?: boolean }) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
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
  const youtubeRef = useRef<YT.Player | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activePlaylistId, setActivePlaylistId] = useState("favorites");

  // State for YouTube-linked playlist playback details
  const [ytPlayingTitle, setYtPlayingTitle] = useState<string>("");
  const [ytPlayingAuthor, setYtPlayingAuthor] = useState<string>("");
  const [ytPlayingVideoId, setYtPlayingVideoId] = useState<string>("");
  const loadedYtPlaylistRef = useRef<string | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);

  const isPlayerReadyRef = useRef<boolean>(false);
  const pendingActionRef = useRef<
    | { type: "video"; videoId: string; shouldPlay: boolean }
    | { type: "playlist"; playlistId: string; shouldPlay: boolean }
    | null
  >(null);

  const shuffleBag = useRef<number[]>([]);
  const startedAtRef = useRef<number>(0);

  const playlists = useMemo(() => user?.playlists ?? [], [user?.playlists]);
  const library = useMemo(() => user?.library ?? [], [user?.library]);
  const volume = user?.volume ?? 80;

  const activePlaylist = useMemo(() => {
    return playlists.find((item) => item.id === activePlaylistId) ?? playlists[0];
  }, [activePlaylistId, playlists]);

  const isYouTubePlaylist = activePlaylist?.type === "youtube" && Boolean(activePlaylist.youtubePlaylistId);

  const tracks = useMemo(() => {
    if (!activePlaylist) return library;
    if (isYouTubePlaylist) return [];
    return activePlaylist.trackIds
      .map((id) => library.find((track) => track.id === id))
      .filter((track): track is Track => Boolean(track));
  }, [activePlaylist, isYouTubePlaylist, library]);

  // Synthetic current track for YouTube-linked playlist or standard track
  const currentTrack: Track | null = useMemo(() => {
    if (isYouTubePlaylist && activePlaylist) {
      return {
        id: `yt-pl-current-${ytPlayingVideoId || activePlaylist.youtubePlaylistId}`,
        title: ytPlayingTitle || activePlaylist.name,
        artist: ytPlayingAuthor || "YouTube",
        cover: ytPlayingVideoId
          ? `https://img.youtube.com/vi/${ytPlayingVideoId}/hqdefault.jpg`
          : `https://img.youtube.com/vi/${activePlaylist.youtubePlaylistId}/hqdefault.jpg`,
        duration: duration || 0,
        album: activePlaylist.name,
        youtubeId: ytPlayingVideoId || undefined,
        url: ytPlayingVideoId ? `https://www.youtube.com/watch?v=${ytPlayingVideoId}` : undefined,
      };
    }
    return tracks[currentIndex] ?? null;
  }, [isYouTubePlaylist, activePlaylist, ytPlayingVideoId, ytPlayingTitle, ytPlayingAuthor, duration, tracks, currentIndex]);

  // Keep startedAt updated when playing begins
  useEffect(() => {
    if (isPlaying) {
      startedAtRef.current = Date.now();
    }
  }, [isPlaying, currentTrack?.id]);

  // Clean internal playback state for Discord or other consumers
  const playbackState: PlaybackState = useMemo(() => ({
    title: currentTrack?.title || "No track playing",
    youtubeId: currentTrack?.youtubeId || ytPlayingVideoId || "",
    playlistId: activePlaylistId || null,
    startedAt: startedAtRef.current,
    duration: duration || currentTrack?.duration || 0,
    paused: !isPlaying,
    currentTime: progress,
  }), [currentTrack, ytPlayingVideoId, activePlaylistId, duration, isPlaying, progress]);

  // Volume synchronization
  useEffect(() => {
    try {
      youtubeRef.current?.setVolume(volume);
    } catch {
      /* empty */
    }
  }, [volume]);

  // Refs for player callbacks
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  isPlayingRef.current = isPlaying;
  volumeRef.current = volume;

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
    [currentIndex, isShuffle, loopMode, tracks]
  );

  const restartCurrent = useCallback(() => {
    setProgress(0);
    setIsPlaying(true);
    try {
      const player = youtubeRef.current;
      if (player && isPlayerReadyRef.current) {
        player.seekTo(0, true);
        player.playVideo();
      }
    } catch {
      /* empty */
    }
  }, []);

  const nextTrack = useCallback(() => {
    if (isYouTubePlaylist) {
      if (youtubeRef.current && isPlayerReadyRef.current) {
        youtubeRef.current.nextVideo();
      }
      setIsPlaying(true);
      return;
    }
    if (!tracks.length) return;
    const upcoming = nextIndex(currentIndex, false);
    if (upcoming === currentIndex && loopMode !== "all" && !isShuffle) return;
    setCurrentIndex(upcoming);
    setProgress(0);
    setIsPlaying(true);
  }, [currentIndex, isShuffle, isYouTubePlaylist, loopMode, nextIndex, tracks.length]);

  const prevTrack = useCallback(() => {
    if (isYouTubePlaylist) {
      if (youtubeRef.current && isPlayerReadyRef.current) {
        youtubeRef.current.previousVideo();
      }
      setIsPlaying(true);
      return;
    }
    if (progress > 3) {
      setProgress(0);
      try {
        if (youtubeRef.current && isPlayerReadyRef.current) {
          youtubeRef.current.seekTo(0, true);
        }
      } catch {
        /* empty */
      }
      return;
    }
    if (!tracks.length) return;
    setCurrentIndex((index) => (index - 1 + tracks.length) % Math.max(tracks.length, 1));
    setProgress(0);
    setIsPlaying(true);
  }, [isYouTubePlaylist, progress, tracks.length]);

  const onTrackEnded = useCallback(() => {
    if (isYouTubePlaylist) return; // YouTube IFrame handles internal playlist next
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
  }, [currentIndex, isYouTubePlaylist, loopMode, nextIndex, restartCurrent, tracks.length]);

  const onTrackEndedRef = useRef(onTrackEnded);
  const nextTrackRef = useRef(nextTrack);
  onTrackEndedRef.current = onTrackEnded;
  nextTrackRef.current = nextTrack;

  // Single persistent YouTube IFrame instance
  useEffect(() => {
    let cancelled = false;

    void loadYoutubeApi().then(() => {
      const api = window.YT;
      if (cancelled || !youtubeHostRef.current || !api) return;

      if (!youtubeRef.current) {
        // Guarantee player always initializes with a valid, unrestricted embeddable video ID without autoplay
        const initialVideoId = "M7lc1UVf-VE";

        youtubeRef.current = new api.Player(youtubeHostRef.current, {
          height: "180",
          width: "320",
          videoId: initialVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            playsinline: 1,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: (event: { target: YT.Player }) => {
              isPlayerReadyRef.current = true;
              event.target.setVolume(volumeRef.current);

              // Drain any pending play or cue requests that arrived before player was ready
              if (pendingActionRef.current) {
                const action = pendingActionRef.current;
                pendingActionRef.current = null;
                if (action.type === "playlist") {
                  event.target.loadPlaylist({
                    listType: "playlist",
                    list: action.playlistId,
                  });
                  if (action.shouldPlay) event.target.playVideo();
                } else if (action.type === "video" && isValidYouTubeId(action.videoId)) {
                  if (action.shouldPlay) {
                    event.target.loadVideoById(action.videoId);
                  } else {
                    event.target.cueVideoById(action.videoId);
                  }
                }
              }
            },
            onStateChange: (event: { data: number; target: YT.Player }) => {
              if (event.data === api.PlayerState.PLAYING) {
                setIsPlaying(true);
                const data = event.target.getVideoData?.();
                if (data) {
                  if (data.title) setYtPlayingTitle(data.title);
                  if (data.author) setYtPlayingAuthor(data.author);
                  if (data.video_id) setYtPlayingVideoId(data.video_id);
                }
              } else if (event.data === api.PlayerState.PAUSED) {
                setIsPlaying(false);
              } else if (event.data === api.PlayerState.ENDED) {
                onTrackEndedRef.current();
              }
            },
            onError: (event: { data: number; target: YT.Player }) => {
              const code = event?.data;
              // Error 100: not found/private, 101/150: embedding disabled by video owner
              if (isPlayingRef.current && (code === 100 || code === 101 || code === 150)) {
                toast.message("Track unavailable for embedding; skipping to next.");
                nextTrackRef.current();
              }
            },
          },
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Play native track when currentTrack changes
  useEffect(() => {
    if (isYouTubePlaylist) return;
    const videoId = currentTrack?.youtubeId;
    if (!isValidYouTubeId(videoId)) return;

    if (loadedVideoIdRef.current === videoId) return;
    loadedVideoIdRef.current = videoId;
    loadedYtPlaylistRef.current = null;

    const player = youtubeRef.current;
    if (player && isPlayerReadyRef.current) {
      if (isPlayingRef.current) {
        player.loadVideoById(videoId);
        player.setVolume(volumeRef.current);
        player.playVideo();
      } else {
        player.cueVideoById(videoId);
        player.setVolume(volumeRef.current);
      }
    } else {
      pendingActionRef.current = {
        type: "video",
        videoId,
        shouldPlay: isPlayingRef.current,
      };
    }
  }, [currentTrack?.youtubeId, isYouTubePlaylist]);

  // Sync play/pause toggle
  useEffect(() => {
    try {
      const player = youtubeRef.current;
      if (!player || !isPlayerReadyRef.current) return;
      if (isPlaying) player.playVideo();
      else player.pauseVideo();
    } catch {
      /* empty */
    }
  }, [isPlaying]);

  // Track progress polling
  useEffect(() => {
    const timer = window.setInterval(() => {
      try {
        const player = youtubeRef.current;
        if (!player || !isPlayerReadyRef.current || !player.getCurrentTime) return;
        const current = player.getCurrentTime() || 0;
        setProgress(current);
        const total = player.getDuration() || 0;
        if (total > 0) setDuration(total);
      } catch {
        /* empty */
      }
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const playTrack = useCallback(
    (index: number, playlistId?: string) => {
      if (playlistId) setActivePlaylistId(playlistId);
      setCurrentIndex(index);
      setIsPlaying(true);
      setProgress(0);
      const targetList = playlistId
        ? playlists.find((p) => p.id === playlistId)
        : activePlaylist;
      if (targetList && targetList.type !== "youtube") {
        const trackId = targetList.trackIds[index];
        const t = library.find((item) => item.id === trackId);
        if (isValidYouTubeId(t?.youtubeId)) {
          loadedVideoIdRef.current = t.youtubeId;
          loadedYtPlaylistRef.current = null;
          const player = youtubeRef.current;
          if (player && isPlayerReadyRef.current) {
            player.loadVideoById(t.youtubeId);
            player.setVolume(volumeRef.current);
            player.playVideo();
          } else {
            pendingActionRef.current = {
              type: "video",
              videoId: t.youtubeId,
              shouldPlay: true,
            };
          }
        }
      }
    },
    [activePlaylist, library, playlists]
  );

  const playYouTubePlaylist = useCallback(
    (playlistId: string) => {
      const target = playlists.find((p) => p.id === playlistId || p.youtubePlaylistId === playlistId);
      const ytId = target?.youtubePlaylistId || playlistId;
      if (!ytId) return;

      if (target) setActivePlaylistId(target.id);
      loadedYtPlaylistRef.current = ytId;
      loadedVideoIdRef.current = null;
      setIsPlaying(true);

      const player = youtubeRef.current;
      if (player && isPlayerReadyRef.current) {
        player.loadPlaylist({
          listType: "playlist",
          list: ytId,
        });
        player.playVideo();
      } else {
        pendingActionRef.current = {
          type: "playlist",
          playlistId: ytId,
          shouldPlay: true,
        };
      }
      toast.success(`Playing ${target?.name || "YouTube Playlist"}`);
    },
    [playlists]
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

  const togglePlay = useCallback(() => {
    if (isYouTubePlaylist && activePlaylist?.youtubePlaylistId) {
      const ytId = activePlaylist.youtubePlaylistId;
      const player = youtubeRef.current;
      if (loadedYtPlaylistRef.current !== ytId) {
        playYouTubePlaylist(activePlaylist.id);
        return;
      }
      if (isPlaying) {
        if (player && isPlayerReadyRef.current) player.pauseVideo();
        setIsPlaying(false);
      } else {
        if (player && isPlayerReadyRef.current) player.playVideo();
        setIsPlaying(true);
      }
      return;
    }

    if (!currentTrack) return;
    setIsPlaying((value) => !value);
  }, [activePlaylist, currentTrack, isPlaying, isYouTubePlaylist, playYouTubePlaylist]);

  const toggleLoopMode = useCallback(() => {
    setLoopMode((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((value) => !value);
    shuffleBag.current = [];
  }, []);

  const setVolume = useCallback(
    (value: number) => {
      const safe = Math.max(0, Math.min(100, value));
      updateUser({ volume: safe });
      try {
        if (youtubeRef.current && isPlayerReadyRef.current) {
          youtubeRef.current.setVolume(safe);
        }
      } catch {
        /* empty */
      }
    },
    [updateUser]
  );

  const seek = useCallback((value: number) => {
    setProgress(value);
    try {
      if (youtubeRef.current && isPlayerReadyRef.current) {
        youtubeRef.current.seekTo(value, true);
      }
    } catch {
      /* empty */
    }
  }, []);

  const setActivePlaylist = useCallback((id: string) => {
    setActivePlaylistId(id);
    setCurrentIndex(0);
    setProgress(0);
  }, []);

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
    },
    [activePlaylistId, updateUser]
  );

  const saveYouTubePlaylist = useCallback(
    async (urlOrId: string, customName?: string) => {
      const parsed = parseYouTubeUrl(urlOrId);
      const playlistId = parsed.type === "playlist" ? parsed.playlistId : urlOrId.trim();

      if (!playlistId || !/^[A-Za-z0-9_-]+$/.test(playlistId)) {
        toast.error("Please provide a valid YouTube playlist URL");
        return null;
      }

      let detectedTitle = customName?.trim();
      if (!detectedTitle) {
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=${playlistId}&format=json`
          );
          if (oembedRes.ok) {
            const data = await oembedRes.json();
            if (data.title) detectedTitle = data.title;
          }
        } catch {
          // Fallback
        }
      }

      const playlistTitle = detectedTitle || "YouTube Playlist";
      const newPl: Playlist = {
        id: `yt-pl-${playlistId}`,
        name: playlistTitle,
        type: "youtube",
        youtubePlaylistId: playlistId,
        description: "YouTube playlist reference",
        cover: `https://img.youtube.com/vi/${playlistId}/hqdefault.jpg`,
        isPublic: true,
        trackIds: [],
      };

      updateUser((current) => {
        const exists = current.playlists.find((p) => p.youtubePlaylistId === playlistId || p.id === newPl.id);
        if (exists) {
          return {
            ...current,
            playlists: current.playlists.map((p) => (p.id === exists.id ? { ...p, name: playlistTitle } : p)),
          };
        }
        return {
          ...current,
          playlists: [...current.playlists, newPl],
        };
      });

      setActivePlaylistId(newPl.id);
      toast.success("Playlist added");
      return newPl;
    },
    [updateUser]
  );

  const importYouTubePlaylist = useCallback(
    async (urlOrId: string, customName?: string) => {
      const pl = await saveYouTubePlaylist(urlOrId, customName);
      return { imported: pl ? 1 : 0, unavailable: 0 };
    },
    [saveYouTubePlaylist]
  );

  const addCustomTrack = useCallback(
    async (input: { url: string; title?: string; artist?: string }) => {
      const raw = input.url.trim();
      if (!raw) return null;

      const parsed = parseYouTubeUrl(raw);
      if (parsed.type === "playlist") {
        await saveYouTubePlaylist(parsed.playlistId, input.title);
        return null;
      }

      const videoId = parsed.type === "video" ? parsed.videoId : extractYouTubeId(raw);
      if (!videoId) {
        toast.error("Please paste a valid YouTube video or playlist link");
        return null;
      }

      const track: Track = {
        id: `yt-${videoId}`,
        youtubeId: videoId,
        provider: "youtube",
        providerId: videoId,
        title: input.title?.trim() || "YouTube Track",
        artist: input.artist?.trim() || "YouTube",
        album: "YouTube",
        cover: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };

      addTracks([track]);
      toast.success("Song added");

      // Asynchronously resolve video metadata without requiring an API key
      if (!input.title?.trim() || !input.artist?.trim()) {
        void fetch(`/api/youtube/video-info?videoId=${videoId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((info) => {
            if (info && (info.title || info.artist)) {
              updateUser((current) => ({
                ...current,
                library: current.library.map((t) =>
                  t.id === track.id
                    ? {
                        ...t,
                        title: input.title?.trim() || info.title || t.title,
                        artist: input.artist?.trim() || info.artist || t.artist,
                        duration: info.duration || t.duration,
                      }
                    : t
                ),
              }));
            }
          })
          .catch(() => {});
      }

      return track;
    },
    [addTracks, saveYouTubePlaylist, updateUser]
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

  const createPlaylist = useCallback(
    (name: string, options?: { activate?: boolean; isPublic?: boolean }) => {
      const playlist: Playlist = {
        id: `pl-${Date.now()}`,
        name: name.trim() || "New playlist",
        description: "",
        type: "native",
        isPublic: options?.isPublic !== false,
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

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      updateUser((current) => ({
        ...current,
        playlists: current.playlists.map((playlist) => (playlist.id === id ? { ...playlist, name } : playlist)),
      }));
    },
    [updateUser]
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      updateUser((current) => ({
        ...current,
        playlists: current.playlists.filter((playlist) => playlist.id !== id),
      }));
      setActivePlaylistId("favorites");
      toast.success("Playlist deleted");
    },
    [updateUser]
  );

  const toggleLiked = useCallback(
    (trackId: string) => {
      updateUser((current) => ({
        ...current,
        playlists: current.playlists.map((playlist) => {
          if (playlist.id !== "favorites" && playlist.id !== "liked") return playlist;
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
      playbackState,
      playTrack,
      playTrackById,
      playYouTubePlaylist,
      togglePlay,
      nextTrack,
      prevTrack,
      toggleLoopMode,
      toggleShuffle,
      setVolume,
      seek,
      setActivePlaylist,
      addCustomTrack,
      saveYouTubePlaylist,
      importYouTubePlaylist,
      addTracks,
      moveTrack,
      removeTrackFromPlaylist,
      deleteTrack,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
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
      playbackState,
      playTrack,
      playTrackById,
      playYouTubePlaylist,
      togglePlay,
      nextTrack,
      prevTrack,
      toggleLoopMode,
      toggleShuffle,
      setVolume,
      seek,
      setActivePlaylist,
      addCustomTrack,
      saveYouTubePlaylist,
      importYouTubePlaylist,
      addTracks,
      moveTrack,
      removeTrackFromPlaylist,
      deleteTrack,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      toggleLiked,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
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
