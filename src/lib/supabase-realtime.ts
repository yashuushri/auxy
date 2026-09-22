import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { Background, RoomParticipant, Track } from "@/lib/types";

export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "SUBSCRIBED";

export type ListenTogetherEventType =
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "TRACK_CHANGE"
  | "BACKGROUND_CHANGE"
  | "REQUEST_STATE"
  | "FULL_STATE_SYNC"
  | "TIME_SYNC";

export interface ListenTogetherLiveEvent {
  eventId: string;
  stateVersion: number;
  type: ListenTogetherEventType;
  videoId?: string;
  track?: Track | null;
  playlistTracks?: Track[];
  playlistName?: string;
  playlistId?: string | null;
  backgroundId?: string | null;
  background?: Background | null;
  positionSeconds: number;
  playing: boolean;
  eventAtMs: number;
  hostId: string;
  hostUsername?: string;
  hostDisplayName?: string;
  hostAvatar?: string;
  listenerId?: string;
  listenerUsername?: string;
}

interface ChannelRecord {
  channel: RealtimeChannel | null;
  status: ConnectionStatus;
  eventQueue: ListenTogetherLiveEvent[];
  eventCallbacks: Set<(event: ListenTogetherLiveEvent) => void>;
  presenceCallbacks: Set<(presence: RoomParticipant[]) => void>;
  statusCallbacks: Set<(status: ConnectionStatus) => void>;
  pollTimer?: ReturnType<typeof setInterval> | null;
  bcListener?: ((e: MessageEvent) => void) | null;
}

let localBroadcastChannel: BroadcastChannel | null = null;

export function getLocalBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!localBroadcastChannel) {
    try {
      localBroadcastChannel = new BroadcastChannel("auxy_listen_together_v1");
    } catch {
      localBroadcastChannel = null;
    }
  }
  return localBroadcastChannel;
}

// Active channels registry to guarantee exactly ONE channel per room
const activeChannelRecords = new Map<string, ChannelRecord>();

// Processed event ID tracking for deduplication
const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENTS = 500;

export function isEventAlreadyProcessed(eventId: string): boolean {
  if (!eventId) return false;
  return processedEventIds.has(eventId);
}

export function markEventAsProcessed(eventId: string): void {
  if (!eventId) return;
  processedEventIds.add(eventId);
  if (processedEventIds.size > MAX_PROCESSED_EVENTS) {
    const iterator = processedEventIds.values();
    const first = iterator.next().value;
    if (first) processedEventIds.delete(first);
  }
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Checks if the channel is completely ready to broadcast over WebSocket without REST fallback
 */
export function isChannelReadyForWebSocketBroadcast(record: ChannelRecord): boolean {
  if (!record.channel) return true;
  if (record.status !== "SUBSCRIBED") return false;
  const rawChannel = record.channel as unknown as {
    state?: string;
    canPush?: () => boolean;
  };
  if (typeof rawChannel.canPush === "function") {
    return rawChannel.canPush();
  }
  return rawChannel.state === "joined";
}

/**
 * Collapse redundant queued events while preserving stateVersion and latest logical state
 */
function enqueueAndCollapse(queue: ListenTogetherLiveEvent[], nextEvent: ListenTogetherLiveEvent): void {
  // If queue is empty, just push
  if (queue.length === 0) {
    queue.push(nextEvent);
    return;
  }

  // 1. If a FULL_STATE_SYNC is added, it completely supersedes everything before it
  if (nextEvent.type === "FULL_STATE_SYNC") {
    queue.length = 0;
    queue.push(nextEvent);
    return;
  }

  // 2. If a REQUEST_STATE is added, collapse to single request
  if (nextEvent.type === "REQUEST_STATE") {
    queue.length = 0;
    queue.push(nextEvent);
    return;
  }

  // 3. TRACK_CHANGE supersedes earlier tracks and their intermediate playback states
  if (nextEvent.type === "TRACK_CHANGE") {
    const bgEvents = queue.filter((ev) => ev.type === "BACKGROUND_CHANGE");
    queue.length = 0;
    queue.push(...bgEvents, nextEvent);
    return;
  }

  // 4. BACKGROUND_CHANGE supersedes earlier BACKGROUND_CHANGE
  if (nextEvent.type === "BACKGROUND_CHANGE") {
    const idx = queue.findIndex((ev) => ev.type === "BACKGROUND_CHANGE");
    if (idx !== -1) {
      queue[idx] = nextEvent;
    } else {
      queue.push(nextEvent);
    }
    return;
  }

  // 5. SEEK: consecutive SEEK events replace each other with the latest position
  if (nextEvent.type === "SEEK") {
    const lastIdx = queue.length - 1;
    if (queue[lastIdx].type === "SEEK") {
      queue[lastIdx] = nextEvent;
      return;
    }
  }

  // 6. PLAY / PAUSE: consecutive play/pause collapses to the latest command
  if (nextEvent.type === "PLAY" || nextEvent.type === "PAUSE") {
    const lastIdx = queue.length - 1;
    if (queue[lastIdx].type === "PLAY" || queue[lastIdx].type === "PAUSE") {
      queue[lastIdx] = nextEvent;
      return;
    }
  }

  // Keep queue bounded to maximum 5 items
  while (queue.length >= 5) {
    queue.shift();
  }
  queue.push(nextEvent);
}

/**
 * Flush all queued events over WebSocket Broadcast once channel is confirmed SUBSCRIBED and ready
 */
async function flushEventQueue(record: ChannelRecord): Promise<void> {
  if (!isChannelReadyForWebSocketBroadcast(record) || record.eventQueue.length === 0) {
    return;
  }

  const eventsToFlush = [...record.eventQueue];
  record.eventQueue.length = 0;

  for (const ev of eventsToFlush) {
    // Re-verify channel readiness before each send to strictly avoid REST fallback
    if (!isChannelReadyForWebSocketBroadcast(record)) {
      record.eventQueue.unshift(ev);
      break;
    }

    try {
      if (record.channel) {
        await record.channel.send({
          type: "broadcast",
          event: "playback_event",
          payload: ev,
        });
      }
    } catch (err) {
      console.warn("[LTT] Error flushing queued event:", err);
    }
  }
}

/**
 * Get or create a singleton Supabase Realtime Channel for a Listen Together room
 */
export function getOrCreateRoomChannel(
  roomId: string,
  onEvent?: (event: ListenTogetherLiveEvent) => void,
  onPresenceSync?: (presence: RoomParticipant[]) => void,
  onStatusChange?: (status: ConnectionStatus) => void
): RealtimeChannel | null {
  const channelTopic = `auxy:ltt:${roomId}`;
  let record = activeChannelRecords.get(channelTopic);

  if (record) {
    if (onEvent) record.eventCallbacks.add(onEvent);
    if (onPresenceSync) record.presenceCallbacks.add(onPresenceSync);
    if (onStatusChange) {
      record.statusCallbacks.add(onStatusChange);
      // Immediately notify current status
      onStatusChange(record.status);
    }
    return record.channel;
  }

  const eventCallbacks = new Set<(event: ListenTogetherLiveEvent) => void>();
  const presenceCallbacks = new Set<(presence: RoomParticipant[]) => void>();
  const statusCallbacks = new Set<(status: ConnectionStatus) => void>();

  if (onEvent) eventCallbacks.add(onEvent);
  if (onPresenceSync) presenceCallbacks.add(onPresenceSync);
  if (onStatusChange) statusCallbacks.add(onStatusChange);

  const supabase = getSupabase();
  const channel = supabase
    ? supabase.channel(channelTopic, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: roomId },
        },
      })
    : null;

  record = {
    channel,
    status: supabase ? "CONNECTING" : "SUBSCRIBED",
    eventQueue: [],
    eventCallbacks,
    presenceCallbacks,
    statusCallbacks,
  };
  activeChannelRecords.set(channelTopic, record);

  // Setup BroadcastChannel cross-tab listener for 0ms multi-tab sync
  const bc = getLocalBroadcastChannel();
  if (bc) {
    const handleBcMessage = (ev: MessageEvent) => {
      try {
        const data = ev.data;
        if (data && data.roomId === roomId && data.event) {
          const liveEvent: ListenTogetherLiveEvent = data.event;
          if (liveEvent.eventId && !isEventAlreadyProcessed(liveEvent.eventId)) {
            record?.eventCallbacks.forEach((cb) => {
              try {
                cb(liveEvent);
              } catch (e) {
                console.warn("[LTT BC] Callback error:", e);
              }
            });
          }
        }
      } catch (err) {
        console.warn("[LTT BC] Error processing broadcast message:", err);
      }
    };
    bc.addEventListener("message", handleBcMessage);
    record.bcListener = handleBcMessage;
  }

  // Setup server state fallback (gentle, only if needed when disconnected, zero aggressive polling)
  if (typeof window !== "undefined") {
    let lastKnownVersion = 0;
    const pollServerState = async () => {
      try {
        const res = await fetch(`/api/rooms/live?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.room && json.room.currentTrack) {
            const r = json.room;
            // ONLY emit state sync if host actually advanced the state version (track change, seek, play/pause)
            if (r.stateVersion > lastKnownVersion) {
              lastKnownVersion = r.stateVersion;
              const syntheticEvent: ListenTogetherLiveEvent = {
                eventId: `poll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                stateVersion: r.stateVersion,
                type: "FULL_STATE_SYNC",
                track: r.currentTrack,
                videoId: r.currentTrack.youtubeId,
                positionSeconds: r.positionSeconds,
                playing: r.isPlaying,
                playlistTracks: r.playlistTracks,
                playlistName: r.playlistName,
                playlistId: r.playlistId,
                background: r.background,
                eventAtMs: r.updatedAt || Date.now(),
                hostId: r.hostUsername,
                hostUsername: r.hostUsername,
                hostDisplayName: r.hostDisplayName,
                hostAvatar: r.hostAvatar,
              };
              record?.eventCallbacks.forEach((cb) => {
                try {
                  cb(syntheticEvent);
                } catch {}
              });
            }
          }
        }
      } catch {
        /* ignore polling errors */
      }
    };

    // Single fast initial check for fresh room state
    void pollServerState();

    // Gentle fallback poll only if WebSocket is not connected (every 15s instead of 2s)
    record.pollTimer = setInterval(() => {
      if (record && record.status !== "SUBSCRIBED") {
        void pollServerState();
      }
    }, 15000);
  }

  if (!channel) {
    setTimeout(() => {
      if (record) {
        record.status = "SUBSCRIBED";
        record.statusCallbacks.forEach((cb) => {
          try {
            cb("SUBSCRIBED");
          } catch {}
        });
      }
    }, 10);
    return null;
  }

  // Listen to live broadcast events
  channel.on(
    "broadcast",
    { event: "playback_event" },
    (payload: { payload: ListenTogetherLiveEvent }) => {
      const liveEvent = payload.payload;
      if (!liveEvent || !liveEvent.eventId) return;

      record?.eventCallbacks.forEach((cb) => {
        try {
          cb(liveEvent);
        } catch (e) {
          console.warn("[LTT] Event callback error:", e);
        }
      });
    }
  );

  // Listen to presence events
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const participants: RoomParticipant[] = [];
    for (const key of Object.keys(state)) {
      const list = state[key] as unknown as RoomParticipant[];
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.id) {
            participants.push(item);
          }
        }
      }
    }
    record?.presenceCallbacks.forEach((cb) => {
      try {
        cb(participants);
      } catch (e) {
        console.warn("[LTT] Presence callback error:", e);
      }
    });
  });

  channel.subscribe((rawStatus) => {
    let newStatus: ConnectionStatus = "DISCONNECTED";
    if (rawStatus === "SUBSCRIBED") {
      newStatus = "SUBSCRIBED";
    } else if (rawStatus === "TIMED_OUT" || rawStatus === "CLOSED" || rawStatus === "CHANNEL_ERROR") {
      newStatus = "DISCONNECTED";
    } else {
      newStatus = "CONNECTING";
    }

    if (record) {
      record.status = newStatus;
      if (process.env.NODE_ENV === "development") {
        console.log(`[LTT] room channel ${channelTopic} status: ${newStatus}`);
      }

      record.statusCallbacks.forEach((cb) => {
        try {
          cb(newStatus);
        } catch (e) {
          console.warn("[LTT] Status callback error:", e);
        }
      });

      if (newStatus === "SUBSCRIBED") {
        void flushEventQueue(record);
        setTimeout(() => {
          if (record && record.status === "SUBSCRIBED") {
            void flushEventQueue(record);
          }
        }, 50);
      }
    }
  });

  return channel;
}

/**
 * Publish an authoritative host broadcast event over Supabase Realtime WebSocket ONLY
 * If channel is not yet SUBSCRIBED and ready, queues the event and flushes on connect (NO REST fallback)
 */
export async function broadcastLivePlaybackEvent(
  roomId: string,
  event: Omit<ListenTogetherLiveEvent, "eventId" | "eventAtMs"> & {
    eventId?: string;
    eventAtMs?: number;
  }
): Promise<string> {
  const eventId = event.eventId || generateEventId();
  const eventAtMs = event.eventAtMs || Date.now();

  const fullEvent: ListenTogetherLiveEvent = {
    ...event,
    eventId,
    eventAtMs,
  };

  markEventAsProcessed(eventId);

  // 1. BroadcastChannel: instant zero-latency sync across tabs
  const bc = getLocalBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({ roomId, event: fullEvent });
    } catch (e) {
      console.warn("[LTT] BroadcastChannel send error:", e);
    }
  }

  // 2. Server state update in background (for cross-client & explore sync)
  if (typeof window !== "undefined" && fullEvent.type !== "REQUEST_STATE") {
    void fetch("/api/rooms/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        hostUsername: fullEvent.hostUsername || fullEvent.hostId,
        currentTrack: fullEvent.track,
        isPlaying: fullEvent.playing,
        positionSeconds: fullEvent.positionSeconds,
        playlistTracks: fullEvent.playlistTracks,
        playlistName: fullEvent.playlistName,
        playlistId: fullEvent.playlistId,
        background: fullEvent.background,
      }),
    }).catch(() => {});
  }

  const channelTopic = `auxy:ltt:${roomId}`;
  let record = activeChannelRecords.get(channelTopic);

  if (!record) {
    getOrCreateRoomChannel(roomId);
    record = activeChannelRecords.get(channelTopic);
  }

  if (!record || !record.channel) {
    return eventId;
  }

  // If status is NOT SUBSCRIBED or socket not ready, queue in memory — NEVER fall back to REST
  if (!isChannelReadyForWebSocketBroadcast(record)) {
    enqueueAndCollapse(record.eventQueue, fullEvent);
    return eventId;
  }

  // WebSocket Broadcast ONLY (status === SUBSCRIBED and ready)
  try {
    if (record.channel) {
      await record.channel.send({
        type: "broadcast",
        event: "playback_event",
        payload: fullEvent,
      });
    }
  } catch (err) {
    console.warn("[LTT] Broadcast send error:", err);
  }

  return eventId;
}

/**
 * Listener broadcasts a REQUEST_STATE to the host when joining or reconnecting
 * Over WebSocket Broadcast ONLY. Queues if channel is still connecting.
 */
export async function broadcastRequestState(
  roomId: string,
  listener: { id: string; username: string }
): Promise<void> {
  const channelTopic = `auxy:ltt:${roomId}`;
  let record = activeChannelRecords.get(channelTopic);
  if (!record) {
    getOrCreateRoomChannel(roomId);
    record = activeChannelRecords.get(channelTopic);
  }
  if (!record) {
    return;
  }

  const event: ListenTogetherLiveEvent = {
    eventId: generateEventId(),
    stateVersion: 0,
    type: "REQUEST_STATE",
    positionSeconds: 0,
    playing: false,
    eventAtMs: Date.now(),
    hostId: "",
    listenerId: listener.id,
    listenerUsername: listener.username,
  };

  // 1. BroadcastChannel cross-tab request
  const bc = getLocalBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({ roomId, event });
    } catch {}
  }

  // 2. Immediately query server for live room state
  if (typeof window !== "undefined") {
    void fetch(`/api/rooms/live?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.room && json.room.currentTrack) {
          const r = json.room;
          const syntheticEvent: ListenTogetherLiveEvent = {
            eventId: `init_sync_${Date.now()}`,
            stateVersion: r.stateVersion,
            type: "FULL_STATE_SYNC",
            track: r.currentTrack,
            videoId: r.currentTrack.youtubeId,
            positionSeconds: r.positionSeconds,
            playing: r.isPlaying,
            playlistTracks: r.playlistTracks,
            playlistName: r.playlistName,
            playlistId: r.playlistId,
            background: r.background,
            eventAtMs: r.updatedAt || Date.now(),
            hostId: r.hostUsername,
            hostUsername: r.hostUsername,
            hostDisplayName: r.hostDisplayName,
            hostAvatar: r.hostAvatar,
          };
          record?.eventCallbacks.forEach((cb) => {
            try {
              cb(syntheticEvent);
            } catch {}
          });
        }
      })
      .catch(() => {});
  }

  if (!record.channel) {
    return;
  }

  // If not ready for WebSocket broadcast, queue in memory
  if (!isChannelReadyForWebSocketBroadcast(record)) {
    enqueueAndCollapse(record.eventQueue, event);
    return;
  }

  try {
    await record.channel.send({
      type: "broadcast",
      event: "playback_event",
      payload: event,
    });
  } catch (err) {
    console.warn("[LTT] Request state broadcast error:", err);
  }
}

/**
 * Track user presence in the room channel
 */
export async function trackRoomPresence(
  roomId: string,
  participant: RoomParticipant
): Promise<void> {
  const channelTopic = `auxy:ltt:${roomId}`;
  const record = activeChannelRecords.get(channelTopic);
  if (!record) return;

  try {
    if (record.status === "SUBSCRIBED" && record.channel) {
      await record.channel.track({
        id: participant.id,
        username: participant.username,
        displayName: participant.displayName,
        avatar: participant.avatar,
        joinedAt: participant.joinedAt || Date.now(),
        lastSeen: Date.now(),
      });
    }
  } catch (err) {
    console.warn("[LTT] Presence tracking error:", err);
  }
}

/**
 * Clean up room channel
 */
export async function leaveRoomChannel(
  roomId: string,
  callbacks?: {
    onEvent?: (event: ListenTogetherLiveEvent) => void;
    onPresenceSync?: (presence: RoomParticipant[]) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
  }
): Promise<void> {
  const supabase = getSupabase();
  const channelTopic = `auxy:ltt:${roomId}`;
  const record = activeChannelRecords.get(channelTopic);

  if (!record) return;

  // Unregister specific callbacks if provided
  if (callbacks) {
    if (callbacks.onEvent) record.eventCallbacks.delete(callbacks.onEvent);
    if (callbacks.onPresenceSync) record.presenceCallbacks.delete(callbacks.onPresenceSync);
    if (callbacks.onStatusChange) record.statusCallbacks.delete(callbacks.onStatusChange);
  }

  // If no more callbacks or explicit teardown, remove channel
  if (
    !callbacks ||
    (record.eventCallbacks.size === 0 &&
      record.presenceCallbacks.size === 0 &&
      record.statusCallbacks.size === 0)
  ) {
    if (record.pollTimer) {
      clearInterval(record.pollTimer);
      record.pollTimer = null;
    }
    if (record.bcListener && localBroadcastChannel) {
      localBroadcastChannel.removeEventListener("message", record.bcListener);
      record.bcListener = null;
    }

    if (supabase && record.channel) {
      try {
        await record.channel.untrack();
        await supabase.removeChannel(record.channel);
      } catch {
        /* ignore cleanup error */
      }
    }
    activeChannelRecords.delete(channelTopic);
    if (process.env.NODE_ENV === "development") {
      console.log(`[LTT] room ${roomId} channel cleaned up`);
    }
  }
}
