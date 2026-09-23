"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  FolderPlus,
  Heart,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  PlusCircle,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { useListenTogether } from "@/context/listen-together-context";
import { formatTime } from "@/lib/music";
import { generatePlaylistNameFromSong, parseYouTubeUrl, validateYouTubePlaylistInput } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { useWindowCompact } from "@/components/floating-window";
import type { Playlist, Track } from "@/lib/types";

function TrackActions({
  track,
  playlists,
  activePlaylistId,
  canMove = false,
  onAdd,
  onMove,
  onNew,
  onRemove,
  onDelete,
}: {
  track: Track;
  playlists: Playlist[];
  activePlaylistId: string;
  canMove?: boolean;
  onAdd: (track: Track, playlistId: string, playlistName: string) => void;
  onMove: (track: Track, playlistId: string, playlistName: string) => void;
  onNew: (track: Track, mode: "add" | "move") => void;
  onRemove?: (track: Track) => void;
  onDelete?: (track: Track) => void;
}) {
  const otherPlaylists = playlists.filter((playlist) => playlist.id !== activePlaylistId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-7 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white transition-colors"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Song options</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 bg-[#1a1a22] text-white border-white/10" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="hover:bg-white/10">
            <ListPlus className="size-4 mr-2" />
            Add to playlist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-48 bg-[#1a1a22] text-white border-white/10">
            {playlists.map((playlist) => {
              const already = playlist.trackIds.includes(track.id);
              return (
                <DropdownMenuItem
                  key={playlist.id}
                  className="hover:bg-white/10"
                  onClick={() => onAdd(track, playlist.id, playlist.name)}
                >
                  {already ? <Check className="size-4 mr-2 text-white/60" /> : <Plus className="size-4 mr-2" />}
                  <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem className="hover:bg-white/10" onClick={() => onNew(track, "add")}>
              <FolderPlus className="size-4 mr-2" />
              New playlist
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {canMove ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="hover:bg-white/10">
              <ArrowRightLeft className="size-4 mr-2" />
              Move to playlist
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48 bg-[#1a1a22] text-white border-white/10">
              {otherPlaylists.length ? (
                otherPlaylists.map((playlist) => (
                  <DropdownMenuItem
                    key={playlist.id}
                    className="hover:bg-white/10"
                    onClick={() => onMove(track, playlist.id, playlist.name)}
                  >
                    <ArrowRightLeft className="size-4 mr-2" />
                    <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled className="text-white/40">No other playlists yet</DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="hover:bg-white/10" onClick={() => onNew(track, "move")}>
                <FolderPlus className="size-4 mr-2" />
                New playlist
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem className="hover:bg-white/10" onClick={() => onNew(track, "add")}>
            <FolderPlus className="size-4 mr-2" />
            New playlist
          </DropdownMenuItem>
        )}
        {onRemove || onDelete ? <DropdownMenuSeparator className="bg-white/10" /> : null}
        {onRemove ? (
          <DropdownMenuItem className="hover:bg-white/10" onClick={() => onRemove(track)}>
            <Trash2 className="size-4 mr-2" />
            Remove from this playlist
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/15" onClick={() => onDelete(track)}>
            <Trash2 className="size-4 mr-2" />
            Delete song
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getHostPlaylistName(rawDisplayName?: string | null, fallbackUsername?: string | null): string {
  const name = (rawDisplayName || fallbackUsername || "Host").trim();
  const firstWord = name.split(/\s+/)[0] || "Host";
  return `${firstWord}'s Playlist`;
}

export function SpotifyWindow() {
  const { user } = useAuth();
  const {
    tracks,
    currentTrack,
    isPlaying,
    loopMode,
    isShuffle,
    volume,
    progress,
    duration,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleLoopMode,
    toggleShuffle,
    setVolume,
    seek,
    addCustomTrack,
    saveYouTubePlaylist,
    deletePlaylist,
    addTracks,
    moveTrack,
    removeTrackFromPlaylist,
    deleteTrack,
    createPlaylist,
    createPlaylistFromYouTube,
    playlists,
    library,
    activePlaylistId,
    setActivePlaylist,
    toggleLiked,
  } = usePlayer();

  const {
    isListener,
    isHost,
    activeHostUsername,
    hostDisplayName,
    hostAvatar,
    hostTracks,
    room,
    broadcastSeek,
  } = useListenTogether();

  const [tab, setTab] = useState("songs");
  const [showAdd, setShowAdd] = useState(false);
  const [addingSubmitting, setAddingSubmitting] = useState(false);
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);
  const [pendingMode, setPendingMode] = useState<"add" | "move">("add");
  const [trackPlaylistOpen, setTrackPlaylistOpen] = useState(false);
  const [trackPlaylistName, setTrackPlaylistName] = useState("");
  
  // Dedicated state for "+ New Playlist" button in Playlists tab
  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [addPlaylistUrl, setAddPlaylistUrl] = useState("");
  const [addPlaylistCustomName, setAddPlaylistCustomName] = useState("");
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false);

  const [filterQuery, setFilterQuery] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [draggingProgress, setDraggingProgress] = useState<number | null>(null);

  const playlistValidation = useMemo(() => {
    return validateYouTubePlaylistInput(addPlaylistUrl);
  }, [addPlaylistUrl]);

  const listenerPlaylistTitle = useMemo(() => {
    const effectiveDisplayName = hostDisplayName || room?.hostDisplayName || activeHostUsername;
    return getHostPlaylistName(effectiveDisplayName, activeHostUsername);
  }, [hostDisplayName, room?.hostDisplayName, activeHostUsername]);

  const effectiveTracks = useMemo(() => {
    if (isListener) {
      if (hostTracks && hostTracks.length > 0) return hostTracks;
      if (room?.playlistTracks && room.playlistTracks.length > 0) return room.playlistTracks;
      if (currentTrack) return [currentTrack];
      return [];
    }
    return tracks;
  }, [isListener, hostTracks, room?.playlistTracks, currentTrack, tracks]);

  const liked = playlists.find((playlist) => playlist.id === "liked" || playlist.id === "favorites");
  const activePlaylist = useMemo(() => {
    if (activePlaylistId === "all_library") {
      return {
        id: "all_library",
        name: "All Library Songs",
        trackIds: library.map((t) => t.id),
        cover: library[0]?.cover,
      };
    }
    return playlists.find((p) => p.id === activePlaylistId) ?? playlists[0];
  }, [activePlaylistId, playlists, library]);

  const emptyList = !effectiveTracks.length;
  const hostPfp = hostAvatar || room?.hostAvatar;
  const heroCover = isListener
    ? (currentTrack?.cover || hostPfp || user?.avatar)
    : (currentTrack?.cover || activePlaylist?.cover || user?.avatar);
  const muted = volume === 0;
  const compact = useWindowCompact();

  const detectedType = useMemo(() => {
    const trimmed = ytUrl.trim();
    if (!trimmed) return null;
    const parsed = parseYouTubeUrl(trimmed);
    if (parsed.type === "playlist") return "playlist";
    if (parsed.type === "video") return "video";
    return "invalid";
  }, [ytUrl]);

  // Fast client-side filter for large playlists
  const displayedTracks = useMemo(() => {
    if (!filterQuery.trim()) return effectiveTracks;
    const q = filterQuery.toLowerCase().trim();
    return effectiveTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [effectiveTracks, filterQuery]);

  // Pre-indexed map for O(1) track index lookups (eliminates O(N^2) lag in 200+ song playlists)
  const trackIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    effectiveTracks.forEach((t, i) => {
      if (t.id) map.set(t.id, i);
      if (t.youtubeId) map.set(t.youtubeId, i);
    });
    return map;
  }, [effectiveTracks]);

  async function handleAddSong(event: React.FormEvent) {
    event.preventDefault();
    if (!ytUrl.trim()) return;

    setAddingSubmitting(true);
    try {
      const parsed = parseYouTubeUrl(ytUrl);
      if (parsed.type === "playlist") {
        const urlToImport = ytUrl;
        const titleToUse = customTitle.trim() || undefined;
        setShowAdd(false);
        setYtUrl("");
        setCustomTitle("");
        setCustomArtist("");
        await saveYouTubePlaylist(urlToImport, titleToUse);
      } else {
        const urlToAdd = ytUrl;
        const titleToAdd = customTitle;
        const artistToAdd = customArtist;
        setShowAdd(false);
        setYtUrl("");
        setCustomTitle("");
        setCustomArtist("");
        await addCustomTrack({ url: urlToAdd, title: titleToAdd, artist: artistToAdd });
      }
    } finally {
      setAddingSubmitting(false);
    }
  }

  async function handleImportPlaylistSubmit(event: React.FormEvent) {
    event.preventDefault();
    const rawUrl = addPlaylistUrl.trim();
    if (!rawUrl) return;

    if (playlistValidation.isSingleVideoOnly) {
      toast.error("Only YouTube playlist links (/playlist?list=...) are accepted here. Use 'Add Music' for single tracks.");
      return;
    }

    if (!playlistValidation.isPlaylist) {
      toast.error("Please enter a valid YouTube playlist link (containing /playlist?list=...)");
      return;
    }

    setIsImportingPlaylist(true);
    try {
      const pl = await createPlaylistFromYouTube(addPlaylistCustomName.trim(), rawUrl);
      if (pl) {
        setShowAddPlaylistModal(false);
        setAddPlaylistUrl("");
        setAddPlaylistCustomName("");
        setTab("songs");
      }
    } finally {
      setIsImportingPlaylist(false);
    }
  }

  function openNewPlaylist(track: Track, mode: "add" | "move") {
    setPendingTrack(track);
    setPendingMode(mode);
    const autoSuggested = track?.title ? generatePlaylistNameFromSong(track.title) : "";
    setTrackPlaylistName(autoSuggested);
    setTrackPlaylistOpen(true);
  }

  function addToPlaylist(track: Track, playlistId: string, playlistName: string) {
    if (playlists.find((playlist) => playlist.id === playlistId)?.trackIds.includes(track.id)) {
      toast.message(`Already in ${playlistName}`);
      return;
    }
    addTracks([track], playlistId);
    toast.success(`Added to ${playlistName}`);
  }

  function transferToPlaylist(track: Track, playlistId: string, playlistName: string) {
    moveTrack(track.id, activePlaylistId, playlistId);
    toast.success(`Moved to ${playlistName}`);
  }

  function removeFromPlaylist(track: Track) {
    removeTrackFromPlaylist(track.id, activePlaylistId);
    toast.success("Removed from this playlist");
  }

  function removeSong(track: Track) {
    deleteTrack(track.id);
    toast.success("Song deleted");
  }

  return (
    <div className={cn("flex w-full flex-col overflow-hidden text-white", compact ? "h-auto" : "h-full min-h-0")}>
      {/* Hero playback section */}
      <div className="relative shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-stretch gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroCover}
            alt=""
            className="size-28 rounded-xl bg-[#16161f] object-cover shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/15 shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              {isListener ? (
                <div className="flex items-center gap-1.5 max-w-full">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-white" title={listenerPlaylistTitle}>
                    {listenerPlaylistTitle}
                  </h1>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex items-center gap-1.5 text-left group/pl cursor-pointer max-w-full hover:opacity-90 transition-opacity outline-none"
                    title="Switch playlist"
                  >
                    <h1 className="truncate text-xl font-semibold tracking-tight">
                      {activePlaylistId === "all_library"
                        ? "All Library Songs"
                        : activePlaylist?.name || user?.displayName || "My Playlist"}
                    </h1>
                    <ChevronDown className="size-4 text-white/50 shrink-0 group-hover/pl:text-white transition-colors" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 bg-[#14141e]/95 backdrop-blur-xl border-white/10 text-white p-1 z-50">
                    <DropdownMenuItem
                      className={cn(
                        "cursor-pointer text-xs flex items-center justify-between py-1.5 px-2.5 rounded-md",
                        activePlaylistId === "all_library" ? "bg-white/20 text-white font-medium" : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                      onClick={() => {
                        setActivePlaylist("all_library");
                        setTab("songs");
                      }}
                    >
                      <span className="font-medium">All Library Songs</span>
                      <span className="text-[10px] text-white/50 font-mono">({library.length})</span>
                    </DropdownMenuItem>
                    <div className="h-px bg-white/10 my-1" />
                    {playlists.map((pl) => (
                      <DropdownMenuItem
                        key={pl.id}
                        className={cn(
                          "cursor-pointer text-xs flex items-center justify-between py-1.5 px-2.5 rounded-md",
                          activePlaylistId === pl.id ? "bg-white/20 text-white font-medium" : "text-white/80 hover:bg-white/10 hover:text-white"
                        )}
                        onClick={() => {
                          setActivePlaylist(pl.id);
                          setTab("songs");
                        }}
                      >
                        <span className="truncate max-w-[170px]">{pl.name}</span>
                        <span className="text-[10px] text-white/50 font-mono ml-2">({pl.trackIds?.length || 0})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <p
                className="mt-0.5 truncate text-xs text-white/60"
                title={currentTrack ? `${currentTrack.title} · ${currentTrack.artist}${currentTrack.album ? ` · ${currentTrack.album}` : ""}` : undefined}
              >
                {currentTrack
                  ? `${currentTrack.title} · ${currentTrack.artist}${currentTrack.album ? ` · ${currentTrack.album}` : ""}`
                  : "Nothing playing yet"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isListener && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-xs text-white/80 hover:bg-white/10 hover:text-white px-2.5 h-7"
                  onClick={() => setShowAdd(true)}
                >
                  <PlusCircle className="size-3.5 mr-1" />
                  Add YouTube Music
                </Button>
              )}
              {isListener && activeHostUsername && (
                <div className="flex items-center gap-1.5 text-xs text-white/60 font-normal select-none">
                  <span className="size-1 rounded-full bg-white/60 shrink-0" />
                  <span>Synced with @{activeHostUsername}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn("text-white/80 hover:bg-white/10 hover:text-white", isListener && "opacity-30 cursor-not-allowed pointer-events-none")}
                onClick={isListener ? undefined : prevTrack}
                disabled={isListener}
                title={isListener ? "Host controls playback" : "Previous track"}
              >
                <SkipBack className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn("text-white/80 hover:bg-white/10 hover:text-white", isListener && "opacity-30 cursor-not-allowed pointer-events-none")}
                onClick={isListener ? undefined : nextTrack}
                disabled={isListener}
                title={isListener ? "Host controls playback" : "Next track"}
              >
                <SkipForward className="size-4" />
              </Button>
              {!isListener ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 transition-colors">
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48 bg-[#1a1a22] text-white border-white/10">
                    <DropdownMenuItem
                      className="text-white hover:bg-white/15"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleLoopMode();
                      }}
                    >
                      {loopMode === "one" ? <Repeat1 className="size-4 mr-2" /> : <Repeat className="size-4 mr-2" />}
                      {loopMode === "off" ? "Loop Off" : loopMode === "one" ? "Loop 1" : "Loop All"}
                      {loopMode !== "off" ? <Check className="ml-auto size-3.5" /> : null}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-white hover:bg-white/15"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleShuffle();
                      }}
                    >
                      <Shuffle className="size-4 mr-2" />
                      Shuffle {isShuffle ? "On" : "Off"}
                      {isShuffle ? <Check className="ml-auto size-3.5" /> : null}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button
                type="button"
                size="icon"
                disabled={isListener}
                className={cn(
                  "ml-1.5 size-9 rounded-full bg-white text-black hover:bg-white/90 shadow-md",
                  isListener && "opacity-40 cursor-not-allowed hover:bg-white pointer-events-none"
                )}
                onClick={isListener ? undefined : togglePlay}
                title={isListener ? `Playback is controlled by host (@${activeHostUsername})` : isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="fill-current size-4" /> : <Play className="ml-0.5 fill-current size-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Progress scrub bar */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="w-9 shrink-0 text-left text-[11px] tabular-nums text-white/70">
            {formatTime(draggingProgress !== null ? draggingProgress : progress)}
          </span>
          <Slider
            tone="glass"
            min={0}
            max={Math.max(duration || currentTrack?.duration || 30, 1)}
            value={[draggingProgress !== null ? draggingProgress : progress]}
            disabled={isListener}
            onValueChange={(value) => {
              if (isListener) return;
              const next = Array.isArray(value) ? value[0] : value;
              setDraggingProgress(next ?? 0);
            }}
            onValueCommitted={(value: number | readonly number[]) => {
              if (isListener) return;
              const next = Array.isArray(value) ? value[0] : value;
              const finalPos = next ?? 0;
              setDraggingProgress(null);
              seek(finalPos);
              if (isHost) {
                broadcastSeek(finalPos);
              }
            }}
            className={cn("flex-1", isListener && "cursor-not-allowed opacity-60 pointer-events-none")}
          />
          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-white/70">
            {formatTime(duration || currentTrack?.duration || 0)}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "player-drawer grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
          compact ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
          emptyList || compact ? "shrink-0" : "min-h-0 flex-1"
        )}
        aria-hidden={compact}
        inert={compact || undefined}
      >
        <div className={cn("flex min-h-0 flex-col overflow-hidden border-t border-white/10", emptyList ? "shrink-0" : "min-h-0 flex-1")}>
          <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className={cn("flex min-h-0 flex-col gap-0", emptyList ? "shrink-0" : "flex-1")}>
            <div className="flex items-center justify-between px-3 pt-2">
              <TabsList className="grid h-7 w-48 grid-cols-2 bg-black/40">
                <TabsTrigger
                  value="songs"
                  className="text-xs text-white/70 hover:text-white data-active:bg-white/20 data-active:text-white"
                >
                  Songs ({effectiveTracks.length})
                </TabsTrigger>
                <TabsTrigger
                  value="lists"
                  className="text-xs text-white/70 hover:text-white data-active:bg-white/20 data-active:text-white"
                >
                  Playlists ({playlists.length})
                </TabsTrigger>
              </TabsList>

              {tab === "songs" && effectiveTracks.length > 10 && (
                <div className="relative w-36">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-white/40" />
                  <Input
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filter..."
                    className="h-6 pl-6 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              )}
            </div>

            <TabsContent value="songs" className={cn("flex min-h-0 flex-col overflow-hidden px-3 pt-2 pb-1", emptyList ? "flex-none" : "flex-1")}>
              {emptyList ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08] cursor-pointer"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
                    <Music2 className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">No songs in playlist</span>
                    <span className="mt-0.5 block text-xs text-white/60">Click to add a YouTube video or playlist</span>
                  </span>
                </button>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1">
                  <div className="space-y-0.5 py-1 pr-2">
                    {displayedTracks.map((track, displayIdx) => {
                      const origIndex = trackIndexMap.get(track.id) ?? (track.youtubeId ? trackIndexMap.get(track.youtubeId) : undefined) ?? displayIdx;
                      const isCurrent = currentTrack?.id === track.id || (currentTrack?.youtubeId && currentTrack.youtubeId === track.youtubeId);
                      const isLiked = liked?.trackIds.includes(track.id);
                      return (
                        <div
                          key={track.id}
                          style={{ contentVisibility: "auto", containIntrinsicSize: "0 44px" }}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 ease-out",
                            isListener ? "cursor-default" : "cursor-pointer",
                            isCurrent ? "bg-white/15" : "hover:bg-white/10"
                          )}
                          onClick={() => {
                            if (isListener) return;
                            playTrack(origIndex >= 0 ? origIndex : displayIdx);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={track.cover || "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
                            alt=""
                            className="size-9 shrink-0 rounded-md object-cover bg-black/40"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-xs text-white", isCurrent ? "font-semibold text-white" : "font-medium")}>
                              {track.title}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-white/65">{track.artist}</p>
                          </div>
                          <div
                            className="flex shrink-0 items-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={cn("rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer", isLiked && "text-white")}
                              onClick={() => toggleLiked(track.id)}
                              title={isLiked ? "Unlike" : "Like"}
                            >
                              <Heart className={cn("size-3.5", isLiked && "fill-current")} />
                            </button>
                            <span className="w-9 text-right font-mono text-[10px] text-white/60">
                              {formatTime(isCurrent && duration > 0 ? duration : track.duration)}
                            </span>
                            {!isListener && (
                              <TrackActions
                                track={track}
                                playlists={playlists}
                                activePlaylistId={activePlaylistId}
                                canMove
                                onAdd={addToPlaylist}
                                onMove={transferToPlaylist}
                                onNew={openNewPlaylist}
                                onRemove={removeFromPlaylist}
                                onDelete={removeSong}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="lists" className="min-h-0 overflow-hidden flex-1 px-3 py-1 flex flex-col">
              <div className="shrink-0 mb-2 flex items-center justify-between px-1 pt-1">
                <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Your Playlists</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-white/80 hover:bg-white/10 hover:text-white px-2 cursor-pointer"
                  onClick={() => {
                    setAddPlaylistUrl("");
                    setAddPlaylistCustomName("");
                    setShowAddPlaylistModal(true);
                  }}
                >
                  <Plus className="size-3 mr-1" />
                  New Playlist
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1">
                <div className="space-y-1 pr-2 pb-2">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-white/10",
                        playlist.id === activePlaylistId ? "bg-white/15 text-white font-medium" : "text-white/80"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActivePlaylist(playlist.id);
                          setTab("songs");
                          if (playlist.trackIds.length > 0 && !isListener) {
                            playTrack(0, playlist.id);
                          }
                        }}
                        className="flex-1 text-left min-w-0 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="text-xs truncate">{playlist.name}</span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-white/50">
                          {`${playlist.trackIds.length} tracks`}
                        </span>
                        {playlist.id !== "favorites" && playlist.id !== "liked" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlaylist(playlist.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-opacity cursor-pointer"
                            title="Delete playlist"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Volume slider at bottom */}
          <div className="flex shrink-0 items-center gap-2.5 border-t border-white/10 px-4 py-2 bg-black/20">
            <button
              type="button"
              className="shrink-0 text-white/75 transition hover:text-white"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setVolume(muted ? 80 : 0)}
            >
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
            <Slider
              tone="glass"
              min={0}
              max={100}
              value={[volume]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                setVolume(next ?? 0);
              }}
              className="flex-1"
            />
            <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-white/70">{volume}</span>
          </div>
        </div>
      </div>

      {/* Add Music Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#14141c] text-white border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white">
              Add YouTube Music or Playlist
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Paste any YouTube video link or full YouTube playlist URL.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSong} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-neutral-300">YouTube URL</Label>
                {detectedType === "video" && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-neutral-300 border border-white/10">
                    Video detected
                  </span>
                )}
                {detectedType === "playlist" && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-neutral-300 border border-white/10">
                    Playlist detected
                  </span>
                )}
              </div>
              <Input
                type="url"
                required
                placeholder="Paste any Youtube link"
                value={ytUrl}
                onChange={(event) => setYtUrl(event.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs"
              />
              <p className="text-[10px] text-white/35">
                {detectedType === "playlist"
                  ? "Imports all playlist songs into your library and playlist."
                  : detectedType === "video"
                  ? "Adds song to your library and active playlist."
                  : "Paste any YouTube song or playlist link."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-neutral-300">Custom Title (optional)</Label>
              <Input
                placeholder="leave blank"
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAdd(false)}
                className="border-white/10 bg-transparent text-white hover:bg-white/10 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingSubmitting || detectedType === "invalid"}
                className="bg-white text-black hover:bg-white/90 text-xs font-medium"
              >
                {addingSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                {detectedType === "playlist" ? "Add Playlist" : "Add Song"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Playlist Modal (Only accepts YouTube playlist URLs) */}
      <Dialog open={showAddPlaylistModal} onOpenChange={setShowAddPlaylistModal}>
        <DialogContent className="bg-[#14141c] text-white border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white">
              Add Playlist
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleImportPlaylistSubmit} className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="addPlaylistUrlInput" className="text-xs text-neutral-300">
                  Playlist link
                </Label>
                {addPlaylistUrl.trim() && (
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full",
                      playlistValidation.isPlaylist
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : playlistValidation.isSingleVideoOnly
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-red-500/20 text-red-300 border border-red-500/30"
                    )}
                  >
                    {playlistValidation.isPlaylist
                      ? "✓ Playlist link"
                      : playlistValidation.isSingleVideoOnly
                      ? "⚠️ Single video link"
                      : "Invalid playlist link"}
                  </span>
                )}
              </div>
              <Input
                id="addPlaylistUrlInput"
                value={addPlaylistUrl}
                onChange={(e) => setAddPlaylistUrl(e.target.value)}
                placeholder="Paste playlist link"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs"
                autoFocus
              />
            </div>

            {playlistValidation.isSingleVideoOnly && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/25 p-2.5 text-xs text-amber-200/90 leading-relaxed">
                <p className="font-semibold text-amber-300 mb-0.5">⚠️ Single Song URL Detected</p>
                This button is only for full playlists (<span className="font-mono text-[11px] text-amber-200">/playlist?list=...</span>). To add individual songs, use the <span className="underline font-medium">Add Music</span> button on top.
              </div>
            )}

            <div className="space-y-1.5 pt-0.5">
              <Label htmlFor="addPlaylistCustomNameInput" className="text-xs text-neutral-300">
                Playlist name
              </Label>
              <Input
                id="addPlaylistCustomNameInput"
                value={addPlaylistCustomName}
                onChange={(e) => setAddPlaylistCustomName(e.target.value)}
                placeholder="Playlist name (optional)"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isImportingPlaylist}
                onClick={() => {
                  setShowAddPlaylistModal(false);
                  setAddPlaylistUrl("");
                  setAddPlaylistCustomName("");
                }}
                className="border-white/10 bg-transparent text-white hover:bg-white/10 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isImportingPlaylist || !playlistValidation.isPlaylist}
                className="bg-white text-black hover:bg-white/90 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                {isImportingPlaylist ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Importing Playlist...
                  </>
                ) : (
                  "Add Playlist"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Track Actions New Playlist Dialog (from "..." menu) */}
      <Dialog open={trackPlaylistOpen} onOpenChange={setTrackPlaylistOpen}>
        <DialogContent className="bg-[#14141c] text-white border-white/10 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {pendingMode === "move" ? "Move to a new playlist" : "Create playlist with song"}
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              {pendingTrack
                ? pendingMode === "move"
                  ? `"${pendingTrack.title}" will move into this playlist.`
                  : `"${pendingTrack.title}" will be added to this playlist.`
                : "Enter a name for the new playlist."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2.5 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trackPlaylistNameInput" className="text-xs text-neutral-300">
                Playlist name
              </Label>
              <Input
                id="trackPlaylistNameInput"
                value={trackPlaylistName}
                onChange={(event) => setTrackPlaylistName(event.target.value)}
                placeholder={
                  pendingTrack?.title ? generatePlaylistNameFromSong(pendingTrack.title) : "My Playlist"
                }
                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTrackPlaylistOpen(false);
                setTrackPlaylistName("");
                setPendingTrack(null);
              }}
              className="border-white/10 bg-transparent text-white hover:bg-white/10 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-white text-black hover:bg-white/90 text-xs cursor-pointer"
              onClick={() => {
                const autoSuggested = pendingTrack?.title
                  ? generatePlaylistNameFromSong(pendingTrack.title)
                  : "";
                const customName = trackPlaylistName.trim();
                const resolvedName = customName || autoSuggested || "My Playlist";

                const playlist = createPlaylist(resolvedName, {
                  activate: false,
                  initialTrack: pendingTrack || undefined,
                  initialTrackName: pendingTrack?.title,
                });
                if (pendingTrack) {
                  if (pendingMode === "move") {
                    moveTrack(pendingTrack.id, activePlaylistId, playlist.id);
                    toast.success(`Moved to ${playlist.name}`);
                  } else {
                    addTracks([pendingTrack], playlist.id);
                    toast.success(`Added to ${playlist.name}`);
                  }
                }
                setPendingTrack(null);
                setPendingMode("add");
                setTrackPlaylistName("");
                setTrackPlaylistOpen(false);
              }}
            >
              {pendingMode === "move" ? "Move song" : "Create Playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
