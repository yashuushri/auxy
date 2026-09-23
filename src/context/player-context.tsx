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
  cleanYouTubeTitle,
  extractYouTubeId,
  formatArtistWithPlatform,
  generatePlaylistNameFromSong,
  getPrimaryArtist,
  isValidYouTubeId,
  parseYouTubeUrl,
} from "@/lib/youtube";
import type { LoopMode, PlaybackState, Playlist, Track } from "@/lib/types";
import { sendActivityLog } from "@/lib/activity-logger";

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
  isPipActive: boolean;
  isPipSupported: boolean;
  togglePictureInPicture: () => Promise<void>;
  play: () => void;
  pause: () => void;
  playTrack: (index: number, playlistId?: string) => void;
  playTrackById: (id: string, playlistId?: string) => void;
  syncToRemoteTrack: (track: Track, targetPosition: number, targetPlaying: boolean) => void;
  clearRemoteTrack: () => void;
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
  createPlaylist: (
    name: string,
    options?: { activate?: boolean; isPublic?: boolean; initialTrack?: Track; initialTrackName?: string }
  ) => Playlist;
  createPlaylistFromYouTube: (name: string, urlOrId: string) => Promise<Playlist | null>;
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
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  const youtubeRef = useRef<YT.Player | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [remoteTrack, setRemoteTrack] = useState<Track | null>(null);
  const [loopMode, setLoopMode] = useState<LoopMode>("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
  const loadedCoverImageRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);

  const [activePlaylistId, setActivePlaylistIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("auxy_active_playlist_id");
        if (saved) return saved;
      } catch {
        /* empty */
      }
    }
    return "favorites";
  });

  const setActivePlaylistId = useCallback((id: string) => {
    setActivePlaylistIdState(id);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("auxy_active_playlist_id", id);
      } catch {
        /* empty */
      }
    }
  }, []);

  // State for YouTube playback details
  const [ytPlayingVideoId, setYtPlayingVideoId] = useState<string>("");
  const loadedYtPlaylistRef = useRef<string | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);

  const isPlayerReadyRef = useRef<boolean>(false);
  const pendingActionRef = useRef<
    | { type: "video"; videoId: string; shouldPlay: boolean; startSeconds?: number }
    | { type: "playlist"; playlistId: string; shouldPlay: boolean }
    | null
  >(null);

  const shuffleBag = useRef<number[]>([]);
  const startedAtRef = useRef<number>(0);
  const hydrationRunIdRef = useRef<number>(0);
  const resolvedCacheRef = useRef<
    Map<string, { title: string; artist: string; duration: number; suggestedPlaylistName?: string }>
  >(new Map());

  const playlists = useMemo(() => user?.playlists ?? [], [user?.playlists]);
  const library = useMemo(() => user?.library ?? [], [user?.library]);
  const volume = user?.volume ?? 80;

  // Auto-switch away from empty Favorites to a populated playlist (e.g. Best's Playlist with 200 songs)
  const hasAutoSwitchedPlaylistRef = useRef(false);
  useEffect(() => {
    if (!playlists || playlists.length === 0) return;
    if (hasAutoSwitchedPlaylistRef.current) return;

    const current = playlists.find((item) => item.id === activePlaylistId);
    if ((!current || current.trackIds.length === 0) && activePlaylistId !== "all_library") {
      const populated = playlists.find((item) => item.trackIds && item.trackIds.length > 0);
      if (populated && populated.id !== activePlaylistId) {
        hasAutoSwitchedPlaylistRef.current = true;
        setActivePlaylistId(populated.id);
      }
    }
  }, [playlists, activePlaylistId, setActivePlaylistId]);

  const activePlaylist = useMemo(() => {
    return playlists.find((item) => item.id === activePlaylistId) ?? playlists[0];
  }, [activePlaylistId, playlists]);

  const tracks = useMemo(() => {
    if (activePlaylistId === "all_library") {
      return library;
    }
    if (!activePlaylist) return library;
    return activePlaylist.trackIds
      .slice(0, 100)
      .map((id) => library.find((track) => track.id === id))
      .filter((track): track is Track => Boolean(track));
  }, [activePlaylistId, activePlaylist, library]);

  const currentTrack: Track | null = useMemo(() => {
    if (remoteTrack) return remoteTrack;
    return tracks[currentIndex] ?? null;
  }, [remoteTrack, tracks, currentIndex]);

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
  }, [progress, tracks.length]);

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

  const onTrackEndedRef = useRef(onTrackEnded);
  const nextTrackRef = useRef(nextTrack);
  const activePlaylistRef = useRef(activePlaylist);
  const hydratePlaylistTracksRef = useRef<((playlistId: string, videoIds: string[]) => void) | null>(null);

  onTrackEndedRef.current = onTrackEnded;
  nextTrackRef.current = nextTrack;
  activePlaylistRef.current = activePlaylist;

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
              try {
                (event.target as unknown as { unMute?: () => void })?.unMute?.();
                event.target.setVolume(volumeRef.current || 80);
              } catch {}

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
                    event.target.loadVideoById(action.videoId, action.startSeconds || 0);
                    event.target.playVideo();
                  } else {
                    event.target.cueVideoById(action.videoId, action.startSeconds || 0);
                  }
                }
              }
            },
            onStateChange: (event: { data: number; target: YT.Player }) => {
              if (event.data === api.PlayerState.PLAYING) {
                setIsPlaying(true);
                const data = event.target.getVideoData?.();
                if (data?.video_id) {
                  setYtPlayingVideoId(data.video_id);
                  // If YouTube player has real title/author, sync immediately to avoid placeholder lag
                  if (data.title && data.title !== "YouTube Video" && data.title !== "YouTube Track") {
                    const rawTitle = data.title;
                    const author = data.author || "YouTube";
                    const { title, artist } = cleanYouTubeTitle(rawTitle);
                    const primaryCreator = getPrimaryArtist(artist === "YouTube" ? author : artist);
                    const formattedArtist = formatArtistWithPlatform(primaryCreator);
                    const cleanTitle = title || rawTitle;

                    resolvedCacheRef.current.set(data.video_id, {
                      title: cleanTitle,
                      artist: formattedArtist,
                      duration: event.target.getDuration?.() || 0,
                    });

                    updateUserRef.current((current) => {
                      const needsFix = current.library.some(
                        (t) =>
                          t.youtubeId === data.video_id &&
                          (!t.title || /^Track\s+\d+$/i.test(t.title) || t.title === "YouTube Track" || t.artist === "YouTube")
                      );
                      if (!needsFix) return current;
                      return {
                        ...current,
                        library: current.library.map((t) =>
                          t.youtubeId === data.video_id
                            ? {
                                ...t,
                                title: cleanTitle,
                                artist: formattedArtist,
                                duration: event.target.getDuration?.() || t.duration,
                              }
                            : t
                        ),
                      };
                    });
                  }
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

  // Play track when currentTrack changes
  useEffect(() => {
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
  }, [currentTrack?.youtubeId]);

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

  // Track progress polling (runs strictly while playing to eliminate CPU/GPU re-render overhead)
  useEffect(() => {
    if (!isPlaying) return;
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
  }, [isPlaying]);

  const playTrack = useCallback(
    (index: number, playlistId?: string) => {
      if (playlistId) setActivePlaylistId(playlistId);
      setCurrentIndex(index);
      setIsPlaying(true);
      setProgress(0);
      const targetList = playlistId
        ? playlists.find((p) => p.id === playlistId)
        : activePlaylist;
      const trackId = targetList?.trackIds?.[index];
      const t = (trackId ? library.find((item) => item.id === trackId) : null) || tracks[index];
      if (isValidYouTubeId(t?.youtubeId)) {
        setRemoteTrack(null);
        loadedVideoIdRef.current = t.youtubeId;
        loadedYtPlaylistRef.current = null;
        const player = youtubeRef.current;
        if (player && isPlayerReadyRef.current) {
          try {
            (player as unknown as { unMute?: () => void })?.unMute?.();
            player.setVolume(volumeRef.current || 80);
          } catch {}
          player.loadVideoById(t.youtubeId);
          player.playVideo();
        } else {
          pendingActionRef.current = {
            type: "video",
            videoId: t.youtubeId,
            shouldPlay: true,
          };
        }
      }
    },
    [activePlaylist, library, playlists, setActivePlaylistId, tracks]
  );

  const playYouTubePlaylist = useCallback(
    (playlistId: string) => {
      setRemoteTrack(null);
      const target = playlists.find((p) => p.id === playlistId || p.youtubePlaylistId === playlistId);
      if (!target) return;
      setActivePlaylistId(target.id);
      if (target.trackIds.length > 0) {
        playTrack(0, target.id);
      }
      toast.success(`Playing ${target.name}`);
    },
    [playlists, playTrack, setActivePlaylistId]
  );

  const playTrackById = useCallback(
    (id: string, playlistId?: string) => {
      setRemoteTrack(null);
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

  const play = useCallback(() => {
    setIsPlaying(true);
    try {
      if (youtubeRef.current && isPlayerReadyRef.current) {
        (youtubeRef.current as unknown as { unMute?: () => void })?.unMute?.();
        youtubeRef.current.setVolume(volumeRef.current || 80);
        youtubeRef.current.playVideo();
      }
    } catch {
      /* empty */
    }
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    try {
      if (youtubeRef.current && isPlayerReadyRef.current) {
        youtubeRef.current.pauseVideo();
      }
    } catch {
      /* empty */
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentTrack) {
      if (tracks.length > 0) {
        playTrack(0);
      }
      return;
    }
    setIsPlaying((value) => !value);
  }, [currentTrack, playTrack, tracks.length]);

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

  const togglePictureInPicture = useCallback(async () => {
    try {
      if (typeof document === "undefined") return;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
        return;
      }
      const video = pipVideoRef.current;
      if (!video) return;

      try {
        await video.play();
      } catch {
        /* empty */
      }

      if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
        setIsPipActive(true);
        toast.success("Floating mini window active!");
      } else {
        toast.info("Picture-in-Picture not supported on this device.");
      }
    } catch (err) {
      console.warn("PiP Request error:", err);
      toast.error("Could not open floating window.");
    }
  }, []);

  // Preload track cover for canvas PiP stream
  useEffect(() => {
    if (!currentTrack?.cover) {
      loadedCoverImageRef.current = null;
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = currentTrack.cover;
    img.onload = () => {
      loadedCoverImageRef.current = { url: currentTrack.cover || "", img };
    };
  }, [currentTrack?.cover]);

  // Picture-in-Picture Video Stream Setup
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsPipSupported(
      Boolean(
        document.pictureInPictureEnabled ||
          ("HTMLVideoElement" in window && "requestPictureInPicture" in HTMLVideoElement.prototype)
      )
    );

    const canvas = pipCanvasRef.current;
    const video = pipVideoRef.current;
    if (!canvas || !video) return;

    try {
      if (typeof canvas.captureStream === "function") {
        const stream = canvas.captureStream(24);
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Canvas captureStream error:", err);
    }

    const onEnterPip = () => setIsPipActive(true);
    const onLeavePip = () => setIsPipActive(false);

    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, []);

  // Picture-in-Picture Canvas Dynamic Drawing Loop
  useEffect(() => {
    if (!isPipActive) return;
    const canvas = pipCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      step++;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, "#0a0b12");
      bgGrad.addColorStop(0.5, "#121422");
      bgGrad.addColorStop(1, "#08090f");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Ambient glow
      const glowGrad = ctx.createRadialGradient(w / 2, h / 2 - 40, 10, w / 2, h / 2 - 40, w / 2);
      glowGrad.addColorStop(0, isPlaying ? "rgba(99, 102, 241, 0.22)" : "rgba(255, 255, 255, 0.05)");
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Top Header: Auxy Logo + Status Badge
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("AUXY", 32, 48);

      // Status pill
      const statusX = w - 140;
      ctx.fillStyle = isPlaying ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.roundRect(statusX, 28, 108, 28, 14);
      ctx.fill();

      // Dot
      ctx.fillStyle = isPlaying ? "#22c55e" : "#94a3b8";
      ctx.beginPath();
      ctx.arc(statusX + 16, 42, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isPlaying ? "#86efac" : "#cbd5e1";
      ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(isPlaying ? "PLAYING" : "PAUSED", statusX + 28, 46);

      // 3. Album Artwork (Centered Card)
      const coverSize = 270;
      const coverX = (w - coverSize) / 2;
      const coverY = 80;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 22);
      ctx.clip();

      const cachedImg = loadedCoverImageRef.current;
      if (cachedImg && cachedImg.img.complete && cachedImg.img.naturalWidth > 0) {
        ctx.drawImage(cachedImg.img, coverX, coverY, coverSize, coverSize);
      } else {
        ctx.fillStyle = "#1e2133";
        ctx.fillRect(coverX, coverY, coverSize, coverSize);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "bold 54px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("♫", coverX + coverSize / 2, coverY + coverSize / 2 + 18);
        ctx.textAlign = "left";
      }
      ctx.restore();

      // Artwork border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 22);
      ctx.stroke();

      // 4. Animated Equalizer bars
      const barCount = 18;
      const barWidth = 6;
      const barGap = 6;
      const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
      const barStartX = (w - totalBarsWidth) / 2;
      const barBaseY = coverY + coverSize + 30;

      for (let i = 0; i < barCount; i++) {
        const freq = (i + 1) * 0.4;
        const wave = isPlaying ? Math.sin(step * 0.15 + freq) * 0.5 + 0.5 : 0.15;
        const barH = isPlaying ? Math.max(4, wave * 22) : 4;
        const bx = barStartX + i * (barWidth + barGap);
        const by = barBaseY - barH / 2;

        const barGrad = ctx.createLinearGradient(bx, by, bx, by + barH);
        barGrad.addColorStop(0, "#a5b4fc");
        barGrad.addColorStop(1, "#6366f1");
        ctx.fillStyle = isPlaying ? barGrad : "rgba(255,255,255,0.2)";

        ctx.beginPath();
        ctx.roundRect(bx, by, barWidth, barH, 3);
        ctx.fill();
      }

      // 5. Track Title & Artist
      const title = currentTrack?.title || "No Track Selected";
      const artist = currentTrack?.artist || "Auxy Music";

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      let displayTitle = title;
      while (ctx.measureText(displayTitle).width > w - 64 && displayTitle.length > 5) {
        displayTitle = displayTitle.slice(0, -4) + "...";
      }
      ctx.fillText(displayTitle, 32, h - 82);

      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      let displayArtist = artist;
      while (ctx.measureText(displayArtist).width > w - 64 && displayArtist.length > 5) {
        displayArtist = displayArtist.slice(0, -4) + "...";
      }
      ctx.fillText(displayArtist, 32, h - 58);

      // 6. Progress scrubber bar
      const barY = h - 26;
      const barW = w - 64;
      const barLeft = 32;

      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.roundRect(barLeft, barY, barW, 4, 2);
      ctx.fill();

      const progressRatio = duration > 0 ? Math.min(1, Math.max(0, progress / duration)) : 0;
      if (progressRatio > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(barLeft, barY, barW * progressRatio, 4, 2);
        ctx.fill();
      }

      // Time stamps
      const curMin = Math.floor(progress / 60);
      const curSec = Math.floor(progress % 60);
      const durMin = Math.floor(duration / 60);
      const durSec = Math.floor(duration % 60);
      const timeStr = `${curMin}:${curSec < 10 ? "0" : ""}${curSec} / ${durMin}:${durSec < 10 ? "0" : ""}${durSec}`;

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "12px monospace";
      ctx.textAlign = "right";
      ctx.fillText(timeStr, w - 32, h - 36);
      ctx.textAlign = "left";

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPipActive, currentTrack, duration, isPlaying, progress]);

  // Keep-alive Audio & Background Playback Handler (Prevents Chrome from freezing audio on phone minimize/lock)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isPlaying) {
      keepAliveAudioRef.current?.play().catch(() => {});
    } else {
      keepAliveAudioRef.current?.pause();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (isPlayingRef.current) {
          keepAliveAudioRef.current?.play().catch(() => {});
          const player = youtubeRef.current;
          if (player && isPlayerReadyRef.current) {
            try {
              player.playVideo();
            } catch {
              /* empty */
            }
          }
        }
      } else if (document.visibilityState === "visible") {
        if (isPlayingRef.current) {
          const player = youtubeRef.current;
          if (player && isPlayerReadyRef.current) {
            try {
              player.playVideo();
            } catch {
              /* empty */
            }
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPlaying]);

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
  }, [setActivePlaylistId]);

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

          // Auto-name playlist if it has no tracks or has a generic/default placeholder name
          const isGeneric =
            !playlist.name ||
            playlist.name.trim() === "" ||
            playlist.name === "New playlist" ||
            playlist.name === "Untitled" ||
            playlist.name === "YouTube Playlist";

          const shouldAutoName = (playlist.trackIds.length === 0 || isGeneric) && incoming[0]?.title;
          const finalName = shouldAutoName
            ? generatePlaylistNameFromSong(incoming[0].title)
            : playlist.name;

          return {
            ...playlist,
            name: finalName,
            trackIds: Array.from(new Set([...playlist.trackIds, ...incoming.map((track) => track.id)])).slice(0, 100),
            cover: incoming[0]?.cover || playlist.cover,
          };
        });
        return { ...current, library: nextLibrary, playlists: nextPlaylists };
      });
    },
    [activePlaylistId, updateUser]
  );

  const syncToRemoteTrack = useCallback(
    (track: Track, targetPosition: number, targetPlaying: boolean) => {
      setRemoteTrack(track);
      addTracks([track]);
      setProgress(targetPosition);
      setIsPlaying(targetPlaying);
      if (track.duration) {
        setDuration(track.duration);
      }

      const videoId = track.youtubeId;
      if (!isValidYouTubeId(videoId)) return;

      const player = youtubeRef.current;
      if (player && isPlayerReadyRef.current) {
        try {
          (player as unknown as { unMute?: () => void })?.unMute?.();
          player.setVolume(volumeRef.current || 80);
        } catch {}

        if (loadedVideoIdRef.current !== videoId) {
          loadedVideoIdRef.current = videoId;
          loadedYtPlaylistRef.current = null;
          const initialPos = targetPosition <= 1.5 ? 0 : targetPosition;
          if (targetPlaying) {
            player.loadVideoById(videoId, initialPos);
            player.playVideo();
          } else {
            player.cueVideoById(videoId, initialPos);
            player.pauseVideo();
          }
        } else {
          // Same video already loaded, adjust position if drifted significantly (> 1.2s)
          try {
            const currentSec = player.getCurrentTime?.() || 0;
            if (Math.abs(currentSec - targetPosition) > 1.2) {
              player.seekTo(targetPosition, true);
            }
            if (targetPlaying) {
              player.playVideo();
            } else {
              player.pauseVideo();
            }
          } catch {
            /* empty */
          }
        }
      } else {
        loadedVideoIdRef.current = videoId;
        pendingActionRef.current = {
          type: "video",
          videoId,
          shouldPlay: targetPlaying,
          startSeconds: targetPosition,
        };
      }
    },
    [addTracks]
  );

  const clearRemoteTrack = useCallback(() => {
    setRemoteTrack(null);
  }, []);

  const hydratePlaylistTracks = useCallback(
    async (playlistId: string, videoIds: string[]) => {
      if (!videoIds || !videoIds.length) return;
      const cleanIds = Array.from(
        new Set(
          videoIds
            .map((id) => extractYouTubeId(id) || id)
            .filter((id): id is string => Boolean(id) && typeof id === "string" && id.length === 11)
        )
      );
      if (!cleanIds.length) return;

      const runId = ++hydrationRunIdRef.current;

      // 1. Instantly register placeholder track records if not already in library & playlist
      updateUser((current) => {
        const existingTrackMap = new Map(current.library.map((t) => [t.id, t]));
        const trackIdsToAdd: string[] = [];

        for (let i = 0; i < cleanIds.length; i++) {
          const vid = cleanIds[i];
          const trackId = `yt-${vid}`;
          trackIdsToAdd.push(trackId);

          if (!existingTrackMap.has(trackId)) {
            const cached = resolvedCacheRef.current.get(vid);
            existingTrackMap.set(trackId, {
              id: trackId,
              youtubeId: vid,
              provider: "youtube" as const,
              providerId: vid,
              title: cached?.title || `Track ${i + 1}`,
              artist: cached?.artist || "YouTube",
              album: "YouTube Playlist",
              cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
              duration: cached?.duration || 0,
              url: `https://www.youtube.com/watch?v=${vid}`,
              sourceUrl: `https://www.youtube.com/watch?v=${vid}`,
            });
          }
        }

        const updatedLibrary = Array.from(existingTrackMap.values());
        const updatedPlaylists = current.playlists.map((pl) => {
          if (pl.youtubePlaylistId === playlistId || pl.id === `yt-pl-${playlistId}` || pl.id === playlistId) {
            return {
              ...pl,
              trackIds: Array.from(new Set([...pl.trackIds, ...trackIdsToAdd])).slice(0, 100),
              cover: pl.cover || `https://img.youtube.com/vi/${cleanIds[0]}/hqdefault.jpg`,
            };
          }
          return pl;
        });

        return {
          ...current,
          library: updatedLibrary,
          playlists: updatedPlaylists,
        };
      });

      // 2. Identify which tracks still need metadata resolution
      const pendingIds = cleanIds.filter((vid) => {
        const cached = resolvedCacheRef.current.get(vid);
        if (!cached) return true;
        if (!cached.title || /^Track\s+\d+$/i.test(cached.title) || cached.title === "YouTube Track") return true;
        return false;
      });

      // 3. Process pending tracks in chunks of 15 via batch API, with non-blocking delays
      const chunkSize = 15;
      for (let i = 0; i < pendingIds.length; i += chunkSize) {
        if (hydrationRunIdRef.current !== runId) break; // If a new run started, abort old one

        const chunk = pendingIds.slice(i, i + chunkSize);
        try {
          const res = await fetch("/api/youtube/video-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoIds: chunk }),
          });

          if (res.ok) {
            const data = await res.json();
            const results: Record<
              string,
              {
                title: string;
                artist: string;
                duration?: number;
                suggestedPlaylistName?: string;
                channelName?: string;
              }
            > = data.results || {};

            // Save to cache
            Object.entries(results).forEach(([vid, info]) => {
              resolvedCacheRef.current.set(vid, {
                title: info.title,
                artist: info.artist || (info.channelName ? formatArtistWithPlatform(info.channelName) : "YouTube"),
                duration: info.duration || 0,
                suggestedPlaylistName: info.suggestedPlaylistName,
              });
            });

            // Apply all updates for this chunk in ONE single state update
            if (hydrationRunIdRef.current === runId) {
              updateUser((current) => {
                const nextLibrary = current.library.map((t) => {
                  if (t.youtubeId && results[t.youtubeId]) {
                    const info = results[t.youtubeId];
                    return {
                      ...t,
                      title: info.title || t.title,
                      artist:
                        info.artist || (info.channelName ? formatArtistWithPlatform(info.channelName) : t.artist),
                      duration: info.duration || t.duration,
                    };
                  }
                  return t;
                });

                // If first track's metadata was resolved, automatically name playlist from the first track's first word
                let firstTrackSuggestedName: string | undefined;
                const firstVid = cleanIds[0];
                if (results[firstVid]?.title) {
                  firstTrackSuggestedName = generatePlaylistNameFromSong(results[firstVid].title);
                } else if (results[firstVid]?.suggestedPlaylistName) {
                  firstTrackSuggestedName = results[firstVid].suggestedPlaylistName;
                }

                const nextPlaylists = current.playlists.map((pl) => {
                  const isThisPlaylist =
                    pl.youtubePlaylistId === playlistId ||
                    pl.id === `yt-pl-${playlistId}` ||
                    pl.id === `pl-yt-${playlistId}` ||
                    pl.id === playlistId;
                  const isGenericName =
                    !pl.name ||
                    pl.name.toLowerCase() === "undefined" ||
                    pl.name.toLowerCase() === "undefined name" ||
                    pl.name.toLowerCase() === "youtube playlist" ||
                    pl.name.toLowerCase() === "new playlist" ||
                    pl.name.toLowerCase() === "my playlist";

                  if (isThisPlaylist && firstTrackSuggestedName && isGenericName) {
                    return { ...pl, name: firstTrackSuggestedName };
                  }
                  return pl;
                });

                return {
                  ...current,
                  library: nextLibrary,
                  playlists: nextPlaylists,
                };
              });
            }
          }
        } catch (err) {
          console.warn("Error hydrating chunk:", err);
        }

        // Non-blocking yield to event loop so the UI remains 100% fluid without frame drops
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    },
    [updateUser]
  );

  hydratePlaylistTracksRef.current = hydratePlaylistTracks;

  const createPlaylistFromYouTube = useCallback(
    async (name: string, urlOrId: string): Promise<Playlist | null> => {
      const trimmedUrl = urlOrId.trim();
      if (!trimmedUrl) {
        toast.error("Please provide a valid YouTube playlist link");
        return null;
      }

      toast.info("Importing YouTube playlist...");

      try {
        const res = await fetch(`/api/youtube/playlist-info?url=${encodeURIComponent(trimmedUrl)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch playlist details");
        }

        const data = await res.json();
        if (!data.ok || !Array.isArray(data.videoIds) || data.videoIds.length === 0) {
          throw new Error("No playable tracks found in this YouTube playlist");
        }

        const userGivenName = name?.trim();
        const isGenericOrUndefinedInput =
          !userGivenName ||
          userGivenName.toLowerCase() === "undefined" ||
          userGivenName.toLowerCase() === "undefined name" ||
          userGivenName.toLowerCase() === "new playlist" ||
          userGivenName.toLowerCase() === "youtube playlist";

        const firstTrackTitle = data.firstTrack?.title || "";
        const suggestedFromFirstTrack = firstTrackTitle ? generatePlaylistNameFromSong(firstTrackTitle) : "";
        const suggestedName = data.suggestedPlaylistName || suggestedFromFirstTrack;

        const resolvedName = !isGenericOrUndefinedInput
          ? userGivenName
          : suggestedName || data.title || "My Playlist";

        const uniquePlId = `pl-yt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const videoIds: string[] = (data.videoIds || []).slice(0, 100);

        const tracksMetaMap = new Map<
          string,
          { title: string; artist: string; duration: number; cover?: string }
        >();
        if (Array.isArray(data.tracks)) {
          for (const t of data.tracks) {
            if (t.videoId && t.title) {
              tracksMetaMap.set(t.videoId, {
                title: t.title,
                artist: t.artist || "YouTube",
                duration: t.duration || 0,
                cover: t.cover,
              });
              resolvedCacheRef.current.set(t.videoId, {
                title: t.title,
                artist: t.artist || "YouTube",
                duration: t.duration || 0,
              });
            }
          }
        }

        const newTracks: Track[] = videoIds.map((vid: string, index: number) => {
          const meta = tracksMetaMap.get(vid);
          const isFirst = index === 0 && data.firstTrack?.videoId === vid && data.firstTrack?.title;
          const trackTitle = meta?.title || (isFirst ? data.firstTrack.title : `Track ${index + 1}`);
          const trackArtist = meta?.artist || (isFirst ? data.firstTrack.artist : "YouTube");
          const trackDuration = meta?.duration || 0;
          const trackCover =
            meta?.cover ||
            (isFirst && data.firstTrack?.cover ? data.firstTrack.cover : `https://img.youtube.com/vi/${vid}/hqdefault.jpg`);

          return {
            id: `yt-${vid}`,
            youtubeId: vid,
            provider: "youtube" as const,
            providerId: vid,
            title: trackTitle,
            artist: trackArtist,
            album: resolvedName,
            cover: trackCover,
            duration: trackDuration,
            url: `https://www.youtube.com/watch?v=${vid}`,
            sourceUrl: `https://www.youtube.com/watch?v=${vid}`,
          };
        });

        const newPlaylist: Playlist = {
          id: uniquePlId,
          name: resolvedName,
          description: `Imported from YouTube (${videoIds.length} tracks)`,
          type: "native",
          youtubePlaylistId: data.playlistId,
          isPublic: true,
          cover: newTracks[0]?.cover || `https://img.youtube.com/vi/${videoIds[0]}/hqdefault.jpg`,
          trackIds: newTracks.map((t) => t.id),
        };

        updateUser((current) => {
          const existingIds = new Set(current.library.map((t) => t.id));
          const tracksToAdd = newTracks.filter((t) => !existingIds.has(t.id));

          return {
            ...current,
            library: [...current.library, ...tracksToAdd],
            playlists: [...current.playlists, newPlaylist],
          };
        });

        setActivePlaylistId(newPlaylist.id);
        setCurrentIndex(0);
        setIsPlaying(true);

        toast.success(`Created "${resolvedName}" with ${videoIds.length} tracks!`);

        // Log playlist import activity (Zero DB calls)
        sendActivityLog({
          action: "playlist_imported",
          user,
          metadata: {
            playlistName: resolvedName,
            trackCount: videoIds.length,
          },
        });

        // Only queue background resolution for tracks that actually lack proper titles
        const unresolvedVids = videoIds.filter((vid) => {
          const meta = tracksMetaMap.get(vid);
          return !meta?.title || meta.title.startsWith("Track ");
        });

        if (unresolvedVids.length > 0) {
          hydratePlaylistTracksRef.current?.(newPlaylist.id, unresolvedVids);
        }

        return newPlaylist;
      } catch (err: unknown) {
        console.error("[Create Playlist From YouTube] Error:", err);
        const errMsg = err instanceof Error ? err.message : "Failed to import YouTube playlist";
        toast.error(errMsg);
        return null;
      }
    },
    [setActivePlaylistId, updateUser, user]
  );

  const saveYouTubePlaylist = useCallback(
    async (urlOrId: string, customName?: string) => {
      return await createPlaylistFromYouTube(customName || "", urlOrId);
    },
    [createPlaylistFromYouTube]
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
            if (playlist.trackIds.length >= 100) return playlist;
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
    (
      name: string,
      options?: { activate?: boolean; isPublic?: boolean; initialTrack?: Track; initialTrackName?: string }
    ) => {
      let resolvedName = name ? name.trim() : "";
      const isGenericOrUndefined =
        !resolvedName ||
        resolvedName.toLowerCase() === "undefined" ||
        resolvedName.toLowerCase() === "undefined name" ||
        resolvedName.toLowerCase() === "new playlist" ||
        resolvedName.toLowerCase() === "youtube playlist" ||
        resolvedName.toLowerCase() === "null";

      if (isGenericOrUndefined) {
        if (options?.initialTrack?.title) {
          resolvedName = generatePlaylistNameFromSong(options.initialTrack.title);
        } else if (options?.initialTrackName) {
          resolvedName = generatePlaylistNameFromSong(options.initialTrackName);
        } else {
          resolvedName = "My Playlist";
        }
      }

      const initialTracks = options?.initialTrack ? [options.initialTrack] : [];
      const playlist: Playlist = {
        id: `pl-${Date.now()}`,
        name: resolvedName,
        description: "",
        type: "native",
        isPublic: options?.isPublic !== false,
        cover: options?.initialTrack?.cover,
        trackIds: initialTracks.map((t) => t.id),
      };

      updateUser((current) => {
        const nextLibrary =
          options?.initialTrack && !current.library.some((t) => t.id === options.initialTrack!.id)
            ? [...current.library, options.initialTrack]
            : current.library;
        return {
          ...current,
          library: nextLibrary,
          playlists: [...current.playlists, playlist],
        };
      });

      if (options?.activate !== false) setActivePlaylistId(playlist.id);
      toast.success(`Playlist "${resolvedName}" created`);
      return playlist;
    },
    [setActivePlaylistId, updateUser]
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
    [setActivePlaylistId, updateUser]
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

  // MediaSession API Integration (Lockscreen controls, track metadata, notification controls)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.playbackState = "none";
      return;
    }

    const artwork: MediaImage[] = [];
    if (currentTrack.cover) {
      artwork.push(
        { src: currentTrack.cover, sizes: "96x96", type: "image/jpeg" },
        { src: currentTrack.cover, sizes: "128x128", type: "image/jpeg" },
        { src: currentTrack.cover, sizes: "256x256", type: "image/jpeg" },
        { src: currentTrack.cover, sizes: "512x512", type: "image/jpeg" }
      );
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || "Unknown Title",
        artist: currentTrack.artist || "Auxy Music",
        album: activePlaylist?.name || "Auxy Playlist",
        artwork: artwork.length > 0 ? artwork : undefined,
      });

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      if (duration > 0 && typeof navigator.mediaSession.setPositionState === "function") {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 1),
          playbackRate: 1,
          position: Math.min(Math.max(progress, 0), duration),
        });
      }
    } catch {
      /* empty */
    }
  }, [currentTrack, isPlaying, duration, progress, activePlaylist?.name]);

  // Register MediaSession Action Handlers
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    const actionMap: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ["play", () => play()],
      ["pause", () => pause()],
      ["previoustrack", () => prevTrack()],
      ["nexttrack", () => nextTrack()],
      [
        "seekto",
        (details) => {
          if (details.seekTime !== undefined) seek(details.seekTime);
        },
      ],
      [
        "seekbackward",
        (details) => {
          const offset = details.seekOffset || 10;
          seek(Math.max(0, progress - offset));
        },
      ],
      [
        "seekforward",
        (details) => {
          const offset = details.seekOffset || 10;
          seek(Math.min(duration || 300, progress + offset));
        },
      ],
      ["stop", () => pause()],
    ];

    actionMap.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* empty */
      }
    });

    return () => {
      actionMap.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* empty */
        }
      });
    };
  }, [play, pause, prevTrack, nextTrack, seek, progress, duration]);

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
      isPipActive,
      isPipSupported,
      togglePictureInPicture,
      play,
      pause,
      playTrack,
      playTrackById,
      syncToRemoteTrack,
      clearRemoteTrack,
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
      createPlaylistFromYouTube,
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
      isPipActive,
      isPipSupported,
      togglePictureInPicture,
      play,
      pause,
      playTrack,
      playTrackById,
      syncToRemoteTrack,
      clearRemoteTrack,
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
      createPlaylistFromYouTube,
      renamePlaylist,
      deletePlaylist,
      toggleLiked,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      <div
        className="pointer-events-none fixed bottom-0 right-0 h-4 w-4 overflow-hidden opacity-[0.01] -z-50"
        aria-hidden="true"
      >
        <div ref={youtubeHostRef} className="h-4 w-4" />
        <canvas ref={pipCanvasRef} width={512} height={512} className="hidden" />
        <video
          ref={pipVideoRef}
          playsInline
          muted
          autoPlay
          className="h-1 w-1 opacity-0 pointer-events-none"
        />
        <audio
          ref={keepAliveAudioRef}
          loop
          playsInline
          src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        />
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
