"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Check,
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
  Video,
  ListMusic,
  ExternalLink,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { formatTime } from "@/lib/music";
import { parseYouTubeUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { useWindowCompact, useHugWindowContent } from "@/components/floating-window";
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
    playYouTubePlaylist,
    deletePlaylist,
    addTracks,
    moveTrack,
    removeTrackFromPlaylist,
    deleteTrack,
    createPlaylist,
    playlists,
    activePlaylistId,
    setActivePlaylist,
    toggleLiked,
  } = usePlayer();

  const [tab, setTab] = useState("songs");
  const [showAdd, setShowAdd] = useState(false);
  const [addingSubmitting, setAddingSubmitting] = useState(false);
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);
  const [pendingMode, setPendingMode] = useState<"add" | "move">("add");
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");

  const liked = playlists.find((playlist) => playlist.id === "liked" || playlist.id === "favorites");
  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) ?? playlists[0];
  const isYouTubePlaylist = activePlaylist?.type === "youtube";
  const emptyList = !isYouTubePlaylist && !tracks.length;
  const heroCover = currentTrack?.cover || user?.avatar;
  const muted = volume === 0;
  const compact = useWindowCompact();
  useHugWindowContent(emptyList);

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
    if (!filterQuery.trim()) return tracks;
    const q = filterQuery.toLowerCase().trim();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [tracks, filterQuery]);

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

  function openNewPlaylist(track: Track, mode: "add" | "move") {
    setPendingTrack(track);
    setPendingMode(mode);
    setNewPlaylistName("");
    setNewPlaylistOpen(true);
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
    <div className={cn("flex w-full flex-col overflow-hidden text-white", emptyList || compact ? "h-auto" : "h-full min-h-0")}>
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
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {activePlaylist?.name || user?.displayName}
              </h1>
              <p className="mt-0.5 truncate text-xs text-white/60">
                {currentTrack ? `${currentTrack.title} · ${currentTrack.artist}` : "Nothing playing yet"}
              </p>
            </div>

            <div className="flex items-center gap-2">
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
            </div>

            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                onClick={prevTrack}
                title="Previous track"
              >
                <SkipBack className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                onClick={nextTrack}
                title="Next track"
              >
                <SkipForward className="size-4" />
              </Button>
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
              <Button
                type="button"
                size="icon"
                className="ml-1.5 size-9 rounded-full bg-white text-black hover:bg-white/90 shadow-md"
                onClick={togglePlay}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="fill-current size-4" /> : <Play className="ml-0.5 fill-current size-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Progress scrub bar */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="w-9 shrink-0 text-left text-[11px] tabular-nums text-white/70">
            {formatTime(progress)}
          </span>
          <Slider
            tone="glass"
            min={0}
            max={Math.max(duration || currentTrack?.duration || 30, 1)}
            value={[progress]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              seek(next ?? 0);
            }}
            className="flex-1"
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
                  Songs ({tracks.length})
                </TabsTrigger>
                <TabsTrigger
                  value="lists"
                  className="text-xs text-white/70 hover:text-white data-active:bg-white/20 data-active:text-white"
                >
                  Playlists ({playlists.length})
                </TabsTrigger>
              </TabsList>

              {tab === "songs" && tracks.length > 10 && (
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
              {isYouTubePlaylist ? (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                  <div className="relative mb-3 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                    <ListMusic className="size-8" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{activePlaylist.name}</h3>
                  <p className="mt-1 max-w-xs text-[11px] text-white/60">
                    YouTube Playlist Reference · Plays sequentially via official YouTube embedded player
                  </p>
                  {currentTrack && (
                    <div className="mt-3 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/90 max-w-xs truncate">
                      <span className="text-white/50 mr-1.5 font-mono">Now Playing:</span>
                      <span className="font-medium">{currentTrack.title}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      onClick={() => playYouTubePlaylist(activePlaylist.id)}
                      className="bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-8 px-4 font-medium"
                    >
                      {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
                      {isPlaying ? "Pause Playlist" : "Play Playlist"}
                    </Button>
                    {activePlaylist.youtubePlaylistId && (
                      <a
                        href={`https://www.youtube.com/playlist?list=${activePlaylist.youtubePlaylistId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/10 rounded-md px-3 h-8 bg-white/5 transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        YouTube
                      </a>
                    )}
                  </div>
                </div>
              ) : emptyList ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]"
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
                <ScrollArea className="h-full px-1 [&_[data-slot=scroll-area-thumb]]:bg-white/25">
                  <div className="space-y-0.5 py-1">
                    {displayedTracks.map((track, displayIdx) => {
                      const origIndex = tracks.findIndex((t) => t.id === track.id);
                      const isCurrent = currentTrack?.id === track.id;
                      const isLiked = liked?.trackIds.includes(track.id);
                      return (
                        <div
                          key={track.id}
                          className={cn(
                            "group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 ease-out",
                            isCurrent ? "bg-white/15" : "hover:bg-white/10"
                          )}
                          onClick={() => playTrack(origIndex >= 0 ? origIndex : displayIdx)}
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
                              className={cn("rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors", isLiked && "text-white")}
                              onClick={() => toggleLiked(track.id)}
                              title={isLiked ? "Unlike" : "Like"}
                            >
                              <Heart className={cn("size-3.5", isLiked && "fill-current")} />
                            </button>
                            <span className="w-9 text-right font-mono text-[10px] text-white/60">
                              {formatTime(isCurrent && duration > 0 ? duration : track.duration)}
                            </span>
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="lists" className="min-h-0 overflow-hidden flex-1 px-3 py-1">
              <ScrollArea className="h-full px-1">
                <div className="space-y-1">
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
                          if (playlist.type === "youtube") {
                            playYouTubePlaylist(playlist.id);
                          }
                        }}
                        className="flex-1 text-left min-w-0 flex items-center gap-2"
                      >
                        <span className="text-xs truncate">{playlist.name}</span>
                        {playlist.type === "youtube" && (
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-300 uppercase tracking-wide">
                            YouTube
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-white/50">
                          {playlist.type === "youtube" ? "Playlist" : `${playlist.trackIds.length} tracks`}
                        </span>
                        {playlist.id !== "favorites" && playlist.id !== "liked" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlaylist(playlist.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-opacity"
                            title="Delete playlist"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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
            <DialogTitle className="flex items-center gap-2 text-base">
              <Video className="size-4 text-red-500" />
              Add YouTube Music or Playlist
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Paste any YouTube video link OR full YouTube playlist URL.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSong} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-neutral-300">YouTube URL</Label>
                {detectedType === "video" && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                    <Video className="size-3" /> Video detected
                  </span>
                )}
                {detectedType === "playlist" && (
                  <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20">
                    <ListMusic className="size-3" /> Playlist detected
                  </span>
                )}
              </div>
              <Input
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=... or playlist?list=..."
                value={ytUrl}
                onChange={(event) => setYtUrl(event.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 text-xs"
              />
              <p className="text-[11px] text-neutral-500">
                {detectedType === "playlist"
                  ? "Saves YouTube playlist reference. Plays sequentially through the official YouTube player."
                  : detectedType === "video"
                  ? "Adds song to your library and active playlist immediately."
                  : "Paste any YouTube video or playlist URL. Auto-detects URL type."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-neutral-300">Custom Title (optional)</Label>
              <Input
                placeholder="Leave blank to auto-detect from YouTube"
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-neutral-300">Artist Name (optional)</Label>
              <Input
                placeholder="Leave blank to auto-detect channel"
                value={customArtist}
                onChange={(event) => setCustomArtist(event.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 text-xs"
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

      {/* New Playlist Dialog */}
      <Dialog open={newPlaylistOpen} onOpenChange={setNewPlaylistOpen}>
        <DialogContent className="bg-[#14141c] text-white border-white/10 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{pendingMode === "move" ? "Move to a new playlist" : "New playlist"}</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              {pendingTrack
                ? pendingMode === "move"
                  ? `"${pendingTrack.title}" will move into this playlist.`
                  : `"${pendingTrack.title}" will be added to this playlist.`
                : "Enter a name for the new playlist."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="newPlaylistName" className="text-xs text-neutral-300">Playlist name</Label>
            <Input
              id="newPlaylistName"
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="Late Night Study"
              className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 text-xs"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewPlaylistOpen(false)}
              className="border-white/10 bg-transparent text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-white text-black hover:bg-white/90 text-xs"
              onClick={() => {
                const playlist = createPlaylist(newPlaylistName.trim() || "New playlist", {
                  activate: false,
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
                setNewPlaylistName("");
                setNewPlaylistOpen(false);
              }}
            >
              {pendingMode === "move" ? "Move song" : pendingTrack ? "Add song" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
