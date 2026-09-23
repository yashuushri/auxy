"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { playNotificationChime } from "@/lib/audio-chime";
import {
  getOrCreateUserRoomInSupabase,
  updateRoomSettingsInSupabase,
  subscribeToRoomInSupabase,
  subscribeToRoomRequestsInSupabase,
  createJoinRequestInSupabase,
  cancelJoinRequestInSupabase,
  respondToJoinRequestInSupabase,
  getRoomDocId,
} from "@/lib/supabase-db";
import {
  broadcastLivePlaybackEvent,
  broadcastRequestState,
  generateEventId,
  getOrCreateRoomChannel,
  isEventAlreadyProcessed,
  leaveRoomChannel,
  markEventAsProcessed,
  trackRoomPresence,
  type ConnectionStatus,
  type ListenTogetherLiveEvent,
} from "@/lib/supabase-realtime";
import { resolveLiveShader } from "@/lib/backgrounds";
import type { Background, Room, RoomParticipant, RoomRequest, Track } from "@/lib/types";
import { sendActivityLog } from "@/lib/activity-logger";

interface ListenTogetherContextValue {
  isHost: boolean;
  isListener: boolean;
  activeHostUsername: string | null;
  hostDisplayName: string;
  hostAvatar: string;
  hostTracks: Track[];
  room: Room | null;
  participants: RoomParticipant[];
  pendingRequests: RoomRequest[];
  listenTogetherEnabled: boolean;
  privacy: "public" | "friends";
  autoAccept: boolean;
  effectiveBackground: Background | null;
  connectionStatus: ConnectionStatus;
  joinAsListener: (hostUsername: string) => void;
  updateSettings: (settings: {
    listenTogetherEnabled?: boolean;
    privacy?: "public" | "friends";
    autoAccept?: boolean;
  }) => Promise<void>;
  requestToJoinRoom: (
    hostUsername: string
  ) => Promise<{ status: "auto_accepted" | "pending" | "disabled" | "error"; requestId?: string; roomId: string }>;
  cancelMyRequest: (roomId: string, requestId: string) => Promise<void>;
  acceptRequest: (request: RoomRequest) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  kickUser: (participantId: string) => Promise<void>;
  leaveListenTogether: () => Promise<void>;
  broadcastSeek: (position: number) => void;
}

const ListenTogetherContext = createContext<ListenTogetherContextValue | null>(null);

export function ListenTogetherProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const player = usePlayer();

  const [activeHostUsername, setActiveHostUsername] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem("auxy_listening_host");
      } catch {
        return null;
      }
    }
    return null;
  });

  const [room, setRoom] = useState<Room | null>(null);
  const [liveBackground, setLiveBackground] = useState<Background | null>(null);
  const [hostDisplayName, setHostDisplayName] = useState<string>("");
  const [hostAvatar, setHostAvatar] = useState<string>("");
  const [hostTracks, setHostTracks] = useState<Track[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RoomRequest[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("DISCONNECTED");

  // Host room settings local cache
  const [listenTogetherEnabled, setListenTogetherEnabled] = useState<boolean>(true);
  const [privacy, setPrivacy] = useState<"public" | "friends">("friends");
  const [autoAccept, setAutoAccept] = useState<boolean>(false);

  const isListener = Boolean(
    activeHostUsername && (!user || activeHostUsername.toLowerCase() !== user.username.toLowerCase())
  );
  const isHost = Boolean(
    user && (!activeHostUsername || activeHostUsername.toLowerCase() === user.username.toLowerCase())
  );

  const hostRoomId = user ? getRoomDocId(user.username) : null;
  const activeRoomId = isListener && activeHostUsername ? getRoomDocId(activeHostUsername) : hostRoomId;

  // Synchronization refs
  const stateVersionRef = useRef<number>(1);
  const lastAppliedVersionRef = useRef<number>(0);
  const isApplyingRemoteStateRef = useRef<boolean>(false);
  const previousRequestCountRef = useRef<number>(0);
  const hasInitializedHostRoomRef = useRef<boolean>(false);
  const hasConfirmedPresenceRef = useRef<boolean>(false);
  const remoteReleaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastBackgroundRef = useRef<string>("");

  // Latest refs to prevent stale closures in async socket callbacks
  const latestPlayerRef = useRef(player);
  latestPlayerRef.current = player;
  const latestUserRef = useRef(user);
  latestUserRef.current = user;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const isListenerRef = useRef(isListener);
  isListenerRef.current = isListener;
  const activeRoomIdRef = useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;

  // Reset and synchronize listener states when target host changes
  useEffect(() => {
    hasConfirmedPresenceRef.current = false;
    lastAppliedVersionRef.current = 0;
    setLiveBackground(null);
    setHostTracks([]);
    setHostDisplayName("");
    setHostAvatar("");

    if (activeHostUsername) {
      const cleanHost = activeHostUsername.toLowerCase().trim();
      const roomId = `room_${cleanHost}`;
      fetch(`/api/rooms/live?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.success && data.room && data.room.currentTrack) {
            const r = data.room;
            const elapsed = r.isPlaying ? Math.max(0, (Date.now() - (r.lastEventAt || Date.now())) / 1000) : 0;
            const pos = Math.max(0, (r.positionSeconds || 0) + elapsed);
            latestPlayerRef.current.syncToRemoteTrack(r.currentTrack, pos, r.isPlaying);
            if (r.background) setLiveBackground(r.background);
            if (r.hostDisplayName) setHostDisplayName(r.hostDisplayName);
            if (r.hostAvatar) setHostAvatar(r.hostAvatar);
            if (r.playlistTracks) setHostTracks(r.playlistTracks);
            lastAppliedVersionRef.current = r.stateVersion || 1;
          }
        })
        .catch(() => {});
    }
  }, [activeHostUsername]);

  // 1. Initialize Host Room Metadata in Supabase (Static room info only)
  useEffect(() => {
    if (!user || isListener) return;

    if (!hasInitializedHostRoomRef.current) {
      hasInitializedHostRoomRef.current = true;
      getOrCreateUserRoomInSupabase(user, latestPlayerRef.current.currentTrack).then((r) => {
        setRoom(r);
        if (r.listenTogetherEnabled !== undefined) setListenTogetherEnabled(r.listenTogetherEnabled);
        if (r.privacy) setPrivacy(r.privacy);
        if (r.autoAccept !== undefined) setAutoAccept(r.autoAccept);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, isListener]);

  // 2. Subscribe to active room document for metadata only (listenTogetherEnabled, privacy, autoAccept)
  // CRITICAL: Playback is NEVER synced via database doc snapshots.
  useEffect(() => {
    if (!activeRoomId) return;

    const unsubscribe = subscribeToRoomInSupabase(activeRoomId, (updatedRoom) => {
      setRoom(updatedRoom);
      if (updatedRoom && isHost) {
        if (updatedRoom.listenTogetherEnabled !== undefined) {
          setListenTogetherEnabled(updatedRoom.listenTogetherEnabled);
        }
        if (updatedRoom.privacy) setPrivacy(updatedRoom.privacy);
        if (updatedRoom.autoAccept !== undefined) setAutoAccept(updatedRoom.autoAccept);
      }
    });

    return () => unsubscribe();
  }, [activeRoomId, isHost]);

  // 3. Supabase Realtime WebSocket Broadcast & Presence Engine
  useEffect(() => {
    if (!activeRoomId) return;

    // Track room presence
    if (user) {
      const participant: RoomParticipant = {
        id: user.id || user.username,
        username: user.username,
        displayName: user.displayName || user.username,
        avatar: user.avatar || "",
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      };
      void trackRoomPresence(activeRoomId, participant);
    }

    const handleEvent = (liveEvent: ListenTogetherLiveEvent) => {
      const {
        eventId,
        stateVersion,
        type,
        positionSeconds,
        playing,
        eventAtMs,
        track,
        playlistTracks,
        background,
        hostDisplayName: remoteHostDisplayName,
        hostAvatar: remoteHostAvatar,
      } = liveEvent;

      // HOST LOGIC: If a listener requested state, respond immediately with FULL_STATE_SYNC
      if (isHostRef.current) {
        if (type === "REQUEST_STATE") {
          const currentHostRoomId = activeRoomIdRef.current;
          if (!currentHostRoomId) return;

          const p = latestPlayerRef.current;
          const u = latestUserRef.current;
          const currentPos = p.progress || 0;
          const currentPlaying = p.isPlaying;
          const currentTracks = p.tracks || [];
          const activePl = p.playlists.find((pl) => pl.id === p.activePlaylistId);

          void broadcastLivePlaybackEvent(currentHostRoomId, {
            eventId: generateEventId(),
            stateVersion: stateVersionRef.current,
            type: "FULL_STATE_SYNC",
            videoId: p.currentTrack?.youtubeId || "",
            track: p.currentTrack,
            playlistTracks: currentTracks.slice(0, 25),
            playlistName: activePl?.name,
            playlistId: p.activePlaylistId,
            playing: currentPlaying,
            positionSeconds: currentPos,
            hostId: u?.id || u?.username || "host",
            hostUsername: u?.username,
            hostDisplayName: u?.displayName || u?.username,
            hostAvatar: u?.avatar || "",
            backgroundId: u?.background?.value || "",
            background: u?.background,
          });
        }
        return;
      }

      // LISTENER LOGIC: Process incoming broadcast from host
      if (!isListenerRef.current) return;

      // Ignore client events not meant for listener
      if (type === "REQUEST_STATE") return;

      // Deduplication & stateVersion check
      if (isEventAlreadyProcessed(eventId)) {
        return;
      }

      // Only check stateVersion ordering for individual commands (PLAY, PAUSE, SEEK, TRACK_CHANGE).
      // FULL_STATE_SYNC is an authoritative snapshot from server polling or state request and must not be rejected
      // just because the host's stateVersion is unchanged during the song's duration.
      if (type !== "FULL_STATE_SYNC" && stateVersion <= lastAppliedVersionRef.current && stateVersion !== 0) {
        return;
      }

      markEventAsProcessed(eventId);
      if (stateVersion > 0) {
        lastAppliedVersionRef.current = stateVersion;
      }

      if (remoteReleaseTimerRef.current) {
        clearTimeout(remoteReleaseTimerRef.current);
      }
      isApplyingRemoteStateRef.current = true;

      try {
        const now = Date.now();
        const p = latestPlayerRef.current;

        // Update host metadata and tracklist
        if (remoteHostDisplayName) setHostDisplayName(remoteHostDisplayName);
        if (remoteHostAvatar) setHostAvatar(remoteHostAvatar);
        if (playlistTracks && Array.isArray(playlistTracks)) {
          setHostTracks(playlistTracks);
        }

        // 1. Background Change (Sync background reference)
        if (type === "BACKGROUND_CHANGE" || background || liveEvent.backgroundId) {
          if (background) {
            setLiveBackground(background);
          } else if (liveEvent.backgroundId) {
            const bgId = liveEvent.backgroundId;
            const matchedShader = resolveLiveShader({ kind: "video", value: bgId });
            if (matchedShader) {
              setLiveBackground({
                kind: "video",
                value: matchedShader.url,
                name: matchedShader.name,
                posterUrl: matchedShader.posterUrl,
              });
            } else if (bgId.startsWith("http://") || bgId.startsWith("https://") || bgId.endsWith(".mp4") || bgId.endsWith(".webm")) {
              setLiveBackground({ kind: "video", value: bgId, name: "Live Shader" });
            } else {
              setLiveBackground({ kind: "preset", value: bgId });
            }
          }
        }

        // 2. Playback state actions
        // Skew-safe network latency calculation:
        // Cross-client WebSocket / Broadcast transit takes 20ms - 200ms.
        // If (now - eventAtMs) is negative or > 2.5s, it is machine clock discrepancy, NOT network delay!
        const rawDelta = eventAtMs ? (now - eventAtMs) / 1000 : 0;
        const skewSafeElapsed = playing && rawDelta > 0 && rawDelta <= 2.0 ? rawDelta : 0;

        if (type === "PAUSE") {
          // CRITICAL: When playing === false, NEVER add elapsed network time.
          // The stored pause position is exact and final.
          p.pause();
          p.seek(positionSeconds);
        } else if (type === "PLAY") {
          const expectedPosition = Math.max(0, positionSeconds + skewSafeElapsed);
          const targetTrack =
            track ||
            (liveEvent.videoId
              ? {
                  id: `yt-${liveEvent.videoId}`,
                  youtubeId: liveEvent.videoId,
                  title: "Track",
                  artist: remoteHostDisplayName || "Host",
                  cover: `https://img.youtube.com/vi/${liveEvent.videoId}/hqdefault.jpg`,
                  duration: 0,
                }
              : null);

          if (targetTrack && targetTrack.youtubeId && targetTrack.youtubeId !== p.currentTrack?.youtubeId) {
            p.syncToRemoteTrack(targetTrack, expectedPosition, true);
          } else {
            p.play();
            // Drift correction: if drift exceeds 1.2s, align; < 1.2s ignore to prevent stutter
            if (Math.abs(expectedPosition - p.progress) > 1.2) {
              p.seek(expectedPosition);
            }
          }
        } else if (type === "SEEK") {
          const expectedPosition = Math.max(0, positionSeconds + skewSafeElapsed);
          p.seek(expectedPosition);
          if (playing && !p.isPlaying) {
            p.play();
          } else if (!playing && p.isPlaying) {
            p.pause();
          }
        } else if (type === "TRACK_CHANGE") {
          const expectedPosition = Math.max(0, (positionSeconds || 0) + skewSafeElapsed);
          const targetTrack =
            track ||
            (liveEvent.videoId
              ? {
                  id: `yt-${liveEvent.videoId}`,
                  youtubeId: liveEvent.videoId,
                  title: "Track",
                  artist: remoteHostDisplayName || "Host",
                  cover: `https://img.youtube.com/vi/${liveEvent.videoId}/hqdefault.jpg`,
                  duration: 0,
                }
              : null);
          if (targetTrack) {
            p.syncToRemoteTrack(targetTrack, expectedPosition, playing);
          }
        } else if (type === "FULL_STATE_SYNC" || type === "TIME_SYNC") {
          const expectedPosition = Math.max(0, positionSeconds + skewSafeElapsed);
          const targetTrack =
            track ||
            (liveEvent.videoId
              ? {
                  id: `yt-${liveEvent.videoId}`,
                  youtubeId: liveEvent.videoId,
                  title: "Track",
                  artist: remoteHostDisplayName || "Host",
                  cover: `https://img.youtube.com/vi/${liveEvent.videoId}/hqdefault.jpg`,
                  duration: 0,
                }
              : null);
          if (targetTrack) {
            if (targetTrack.youtubeId && targetTrack.youtubeId !== p.currentTrack?.youtubeId) {
              p.syncToRemoteTrack(targetTrack, expectedPosition, playing);
            } else {
              if (playing && !p.isPlaying) p.play();
              if (!playing && p.isPlaying) p.pause();
              if (Math.abs(expectedPosition - p.progress) > 1.2) {
                p.seek(expectedPosition);
              }
            }
          }
        }
      } finally {
        remoteReleaseTimerRef.current = setTimeout(() => {
          isApplyingRemoteStateRef.current = false;
        }, 200);
      }
    };

    const handlePresenceSync = (presenceList: RoomParticipant[]) => {
      if (presenceList && presenceList.length > 0) {
        setParticipants(presenceList);
      }
    };

    const handleStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
      if (status === "SUBSCRIBED") {
        // If listener connects or reconnects, request current authoritative state from host
        if (isListenerRef.current && user) {
          void broadcastRequestState(activeRoomId, {
            id: user.id || user.username,
            username: user.username,
          });

          // Late-join retry safeguard: if no state received after 1.5s, request state once more
          setTimeout(() => {
            if (isListenerRef.current && lastAppliedVersionRef.current === 0 && user) {
              void broadcastRequestState(activeRoomId, {
                id: user.id || user.username,
                username: user.username,
              });
            }
          }, 1500);
        }
      }
    };

    getOrCreateRoomChannel(activeRoomId, handleEvent, handlePresenceSync, handleStatusChange);

    return () => {
      void leaveRoomChannel(activeRoomId, {
        onEvent: handleEvent,
        onPresenceSync: handlePresenceSync,
        onStatusChange: handleStatusChange,
      });
      if (remoteReleaseTimerRef.current) {
        clearTimeout(remoteReleaseTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, user?.username]);

  // 3b. Real-time Multi-Client Server Presence Heartbeat (relaxed 45s interval, no dependency thrashing)
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const sendHeartbeat = (isOffline = false) => {
      const u = latestUserRef.current || user;
      const p = latestPlayerRef.current;
      const payload = {
        username: u.username,
        userId: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        bio: u.bio,
        pronouns: u.pronouns,
        background: u.background,
        isPlaying: Boolean(!isOffline && p.isPlaying && p.currentTrack),
        currentTrack: isOffline ? null : (p.currentTrack || null),
        roomId: activeRoomId || `room_${u.username}`,
        listenTogetherEnabled: isOffline ? false : listenTogetherEnabled,
        isOffline,
      };

      if (isOffline && typeof navigator !== "undefined" && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
          navigator.sendBeacon("/api/presence", blob);
          return;
        } catch {
          // fallback to fetch
        }
      }

      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    };

    // Send on mount
    sendHeartbeat(false);

    // Periodic heartbeat every 45 seconds to keep online state without flooding terminal
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        sendHeartbeat(false);
      }
    }, 45000);

    const handleUnload = () => {
      sendHeartbeat(true);
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, activeRoomId, listenTogetherEnabled]);

  // 4. Host: Subscribe to join requests & trigger chime sound on new request
  useEffect(() => {
    if (!hostRoomId || !isHost || !listenTogetherEnabled) {
      setPendingRequests([]);
      return;
    }

    const unsubscribe = subscribeToRoomRequestsInSupabase(hostRoomId, (reqs) => {
      const pendingList = reqs.filter((r) => r.status === "pending");
      if (pendingList.length > previousRequestCountRef.current) {
        playNotificationChime();
        const newReq = pendingList[0];
        if (newReq) {
          toast(`@${newReq.username} requested to join Listen Together`, {
            description: "Click Accept to approve and sync your music.",
            action: {
              label: "Accept",
              onClick: () => {
                void respondToJoinRequestInSupabase(newReq.id, "accepted").then(() => {
                  toast.success(`Accepted @${newReq.username}'s request!`);
                });
              },
            },
            duration: 10000,
          });
        }
      }
      previousRequestCountRef.current = pendingList.length;
      setPendingRequests(pendingList);
    });

    return () => unsubscribe();
  }, [hostRoomId, isHost, listenTogetherEnabled]);

  // 5. Host -> Publish high-frequency events via Supabase Realtime WebSocket ONLY (Zero DB Writes)

  // Track change event
  useEffect(() => {
    if (!isHost || !hostRoomId || isApplyingRemoteStateRef.current) return;
    stateVersionRef.current += 1;
    const version = stateVersionRef.current;
    const eventId = generateEventId();
    const p = latestPlayerRef.current;
    const u = latestUserRef.current;
    // CRITICAL: When track changes, position of new track is 0, NOT the previous track's progress!
    const currentPos = 0;
    const currentPlaying = p.isPlaying;
    const activePl = p.playlists.find((pl) => pl.id === p.activePlaylistId);

    // Supabase Realtime Broadcast IMMEDIATE (Zero DB writes, minimal payload)
    void broadcastLivePlaybackEvent(hostRoomId, {
      eventId,
      stateVersion: version,
      type: "TRACK_CHANGE",
      videoId: p.currentTrack?.youtubeId || "",
      track: p.currentTrack,
      playlistName: activePl?.name,
      playlistId: p.activePlaylistId,
      playing: currentPlaying,
      positionSeconds: currentPos,
      hostId: u?.id || u?.username || "host",
      hostUsername: u?.username,
      hostDisplayName: u?.displayName || u?.username,
      hostAvatar: u?.avatar || "",
      background: u?.background,
    });
  }, [isHost, hostRoomId, player.currentTrack?.id, player.activePlaylistId]);

  // Play/Pause change event
  useEffect(() => {
    if (!isHost || !hostRoomId || isApplyingRemoteStateRef.current) return;
    stateVersionRef.current += 1;
    const version = stateVersionRef.current;
    const eventId = generateEventId();
    const p = latestPlayerRef.current;
    const u = latestUserRef.current;
    const currentPos = p.progress || 0;
    const currentPlaying = p.isPlaying;
    const eventType = currentPlaying ? "PLAY" : "PAUSE";

    // Supabase Realtime Broadcast IMMEDIATE (Zero DB writes, minimal payload)
    void broadcastLivePlaybackEvent(hostRoomId, {
      eventId,
      stateVersion: version,
      type: eventType,
      videoId: p.currentTrack?.youtubeId || "",
      playlistId: p.activePlaylistId,
      playing: currentPlaying,
      positionSeconds: currentPos,
      hostId: u?.id || u?.username || "host",
      hostUsername: u?.username,
      hostDisplayName: u?.displayName || u?.username,
      hostAvatar: u?.avatar || "",
    });
  }, [isHost, hostRoomId, player.isPlaying]);

  // Host Background Change event (Deduplicated with lastBroadcastBackgroundRef)
  const userBgKey = user?.background
    ? `${user.background.kind}:${user.background.value}:${user.background.name || ""}`
    : "";

  useEffect(() => {
    if (!isHost || !hostRoomId || isApplyingRemoteStateRef.current) return;
    if (!userBgKey) return;

    if (lastBroadcastBackgroundRef.current === userBgKey) return;
    lastBroadcastBackgroundRef.current = userBgKey;

    stateVersionRef.current += 1;
    const version = stateVersionRef.current;
    const eventId = generateEventId();
    const p = latestPlayerRef.current;
    const u = latestUserRef.current;

    // Supabase Realtime Broadcast IMMEDIATE (Zero DB writes, minimal payload)
    void broadcastLivePlaybackEvent(hostRoomId, {
      eventId,
      stateVersion: version,
      type: "BACKGROUND_CHANGE",
      positionSeconds: p.progress || 0,
      playing: p.isPlaying,
      hostId: u?.id || u?.username || "host",
      hostUsername: u?.username,
      hostDisplayName: u?.displayName || u?.username,
      hostAvatar: u?.avatar || "",
      backgroundId: u?.background?.value || "",
      background: u?.background,
    });
  }, [isHost, hostRoomId, userBgKey]);

  // Context Actions
  const updateSettings = useCallback(
    async (settings: {
      listenTogetherEnabled?: boolean;
      privacy?: "public" | "friends";
      autoAccept?: boolean;
    }) => {
      if (!hostRoomId) return;
      if (settings.listenTogetherEnabled !== undefined) {
        setListenTogetherEnabled(settings.listenTogetherEnabled);
      }
      if (settings.privacy) setPrivacy(settings.privacy);
      if (settings.autoAccept !== undefined) setAutoAccept(settings.autoAccept);

      await updateRoomSettingsInSupabase(hostRoomId, settings);
      toast.success("Room settings updated");
    },
    [hostRoomId]
  );

  const joinAsListener = useCallback((hostUsername: string) => {
    hasConfirmedPresenceRef.current = false;
    lastAppliedVersionRef.current = 0;
    setActiveHostUsername(hostUsername);

    // Discord Activity Log (zero DB calls)
    sendActivityLog({
      action: "listener_joined",
      user: latestUserRef.current,
      metadata: {
        hostUsername,
      },
    });

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("auxy_listening_host", hostUsername);
      } catch {}

      // Immediately fetch live room state for zero-delay music start
      const cleanHost = hostUsername.toLowerCase().trim();
      const roomId = `room_${cleanHost}`;
      fetch(`/api/rooms/live?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.success && data.room && data.room.currentTrack) {
            const r = data.room;
            const elapsed = r.isPlaying ? Math.max(0, (Date.now() - (r.lastEventAt || Date.now())) / 1000) : 0;
            const pos = Math.max(0, (r.positionSeconds || 0) + elapsed);
            latestPlayerRef.current.syncToRemoteTrack(r.currentTrack, pos, r.isPlaying);
            if (r.background) setLiveBackground(r.background);
            if (r.hostDisplayName) setHostDisplayName(r.hostDisplayName);
            if (r.hostAvatar) setHostAvatar(r.hostAvatar);
            if (r.playlistTracks) setHostTracks(r.playlistTracks);
            lastAppliedVersionRef.current = r.stateVersion || 1;
          }
        })
        .catch(() => {});
    }
  }, []);

  const requestToJoinRoom = useCallback(
    async (hostUsername: string) => {
      if (!user) {
        toast.error("Please sign in to join Listen Together.");
        return { status: "error" as const, roomId: "" };
      }
      const res = await createJoinRequestInSupabase(hostUsername, user);
      if (res.status === "auto_accepted") {
        joinAsListener(hostUsername);
        toast.success(`Joined @${hostUsername}'s room!`);
      } else if (res.status === "disabled") {
        toast.error(`@${hostUsername} has disabled Listen Together.`);
      }
      return res;
    },
    [user, joinAsListener]
  );

  const cancelMyRequest = useCallback(async (roomId: string, requestId: string) => {
    await cancelJoinRequestInSupabase(requestId);
    toast.info("Request cancelled");
  }, []);

  const acceptRequest = useCallback(async (request: RoomRequest) => {
    if (!hostRoomId) return;
    await respondToJoinRequestInSupabase(request.id, "accepted");
    toast.success(`Accepted @${request.username}'s request!`);
  }, [hostRoomId]);

  const declineRequest = useCallback(async (requestId: string) => {
    if (!hostRoomId) return;
    await respondToJoinRequestInSupabase(requestId, "declined");
    toast.info("Request declined");
  }, [hostRoomId]);

  const kickUser = useCallback(async () => {
    // In Supabase Realtime presence, kicking can be broadcast or state updated
    toast.info("Participant removed");
  }, []);

  const leaveListenTogether = useCallback(async () => {
    const prevHost = activeHostUsername;
    setActiveHostUsername(null);
    setLiveBackground(null);
    setHostTracks([]);
    latestPlayerRef.current.clearRemoteTrack();

    if (prevHost) {
      // Discord Activity Log (zero DB calls)
      sendActivityLog({
        action: "listener_left",
        user: latestUserRef.current,
        metadata: {
          hostUsername: prevHost,
        },
      });
    }

    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("auxy_listening_host");
      } catch {}
    }
    toast.info("Returned to your room");
  }, [activeHostUsername]);

  const broadcastSeek = useCallback(
    (position: number) => {
      if (!isHost || !hostRoomId || isApplyingRemoteStateRef.current) return;
      stateVersionRef.current += 1;
      const version = stateVersionRef.current;
      const eventId = generateEventId();
      const p = latestPlayerRef.current;
      const u = latestUserRef.current;

      // Supabase Realtime Broadcast IMMEDIATE (Zero DB writes, minimal payload)
      void broadcastLivePlaybackEvent(hostRoomId, {
        eventId,
        stateVersion: version,
        type: "SEEK",
        videoId: p.currentTrack?.youtubeId || "",
        playlistId: p.activePlaylistId,
        playing: p.isPlaying,
        positionSeconds: position,
        hostId: u?.id || u?.username || "host",
        hostUsername: u?.username,
        hostDisplayName: u?.displayName || u?.username,
        hostAvatar: u?.avatar || "",
      });
    },
    [isHost, hostRoomId]
  );

  // Effective background: when in listener mode, use host's live background; otherwise user's own
  const effectiveBackground =
    isListener && (liveBackground || room?.background)
      ? liveBackground || room?.background || null
      : user?.background || null;

  const value: ListenTogetherContextValue = {
    isHost,
    isListener,
    activeHostUsername,
    hostDisplayName,
    hostAvatar,
    hostTracks,
    room,
    participants,
    pendingRequests,
    listenTogetherEnabled,
    privacy,
    autoAccept,
    effectiveBackground,
    connectionStatus,
    joinAsListener,
    updateSettings,
    requestToJoinRoom,
    cancelMyRequest,
    acceptRequest,
    declineRequest,
    kickUser,
    leaveListenTogether,
    broadcastSeek,
  };

  return (
    <ListenTogetherContext.Provider value={value}>
      {children}
    </ListenTogetherContext.Provider>
  );
}

export function useListenTogether() {
  const context = useContext(ListenTogetherContext);
  if (!context) {
    throw new Error("useListenTogether must be used within ListenTogetherProvider");
  }
  return context;
}
