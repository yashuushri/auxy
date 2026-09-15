"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Check,
  FolderPlus,
  Heart,
  ListPlus,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  PlusCircle,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
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
        className="inline-flex size-7 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Song options</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ListPlus />
            Add to playlist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-48">
            {playlists.map((playlist) => {
              const already = playlist.trackIds.includes(track.id);
              return (
                <DropdownMenuItem
                  key={playlist.id}
                  onClick={() => onAdd(track, playlist.id, playlist.name)}
                >
                  {already ? <Check /> : <Plus />}
                  <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNew(track, "add")}>
              <FolderPlus />
              New playlist
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {canMove ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft />
              Move to playlist
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48">
              {otherPlaylists.length ? (
                otherPlaylists.map((playlist) => (
                  <DropdownMenuItem
                    key={playlist.id}
                    onClick={() => onMove(track, playlist.id, playlist.name)}
                  >
                    <ArrowRightLeft />
                    <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No other playlists yet</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onNew(track, "move")}>
                <FolderPlus />
                New playlist
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem onClick={() => onNew(track, "add")}>
            <FolderPlus />
            New playlist
          </DropdownMenuItem>
        )}
        {onRemove || onDelete ? <DropdownMenuSeparator /> : null}
        {onRemove ? (
          <DropdownMenuItem onClick={() => onRemove(track)}>
            <Trash2 />
            Remove from this playlist
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(track)}>
            <Trash2 />
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
    currentIndex,
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
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);
  const [pendingMode, setPendingMode] = useState<"add" | "move">("add");
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");

  const liked = playlists.find((playlist) => playlist.id === "liked");
  const emptyList = !tracks.length;
  const heroCover = currentTrack?.cover || user?.avatar;
  const muted = volume === 0;
  const compact = useWindowCompact();
  useHugWindowContent(emptyList);

  function handleAddSong(event: React.FormEvent) {
    event.preventDefault();
    addCustomTrack({ url: ytUrl, title: customTitle, artist: customArtist });
    setYtUrl("");
    setCustomTitle("");
    setCustomArtist("");
    setShowAdd(false);
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
      <div className="relative shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-stretch gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroCover}
            alt=""
            className="size-28 rounded-xl bg-[#16161f] object-cover shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/15"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{user?.displayName}</h1>
            <p className="mt-0.5 truncate text-xs text-white/55">
              {currentTrack ? `${currentTrack.title} · ${currentTrack.artist}` : "Nothing playing yet"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1.5 w-fit text-white/90 hover:bg-white/10 hover:text-white"
              onClick={() => setShowAdd(true)}
            >
              <PlusCircle data-icon="inline-start" />
              Add more music
            </Button>
            <div className="mt-auto flex items-center justify-end gap-0.5">
              <Button type="button" variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" onClick={prevTrack}>
                <SkipBack />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" onClick={nextTrack}>
                <SkipForward />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-lg text-white hover:bg-white/10">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48 bg-[#1a1a22] text-white">
                  <DropdownMenuItem
                    className="text-white focus:bg-white/15 focus:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleLoopMode();
                    }}
                  >
                    {loopMode === "one" ? <Repeat1 /> : <Repeat />}
                    {loopMode === "off" ? "Loop Off" : loopMode === "one" ? "Loop 1" : "Loop All"}
                    {loopMode !== "off" ? <Check className="ml-auto" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-white focus:bg-white/15 focus:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleShuffle();
                    }}
                  >
                    <Shuffle />
                    Shuffle {isShuffle ? "On" : "Off"}
                    {isShuffle ? <Check className="ml-auto" /> : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                size="icon"
                className="ml-1 size-10 rounded-full bg-white text-black hover:bg-white/90"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="fill-current" /> : <Play className="ml-0.5 fill-current" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="w-9 shrink-0 text-left text-[11px] tabular-nums text-white/80">
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
          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-white/80">
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
        <div className={cn("flex min-h-0 flex-col overflow-hidden border-t border-white/15", emptyList ? "shrink-0" : "min-h-0 flex-1")}>
          <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className={cn("flex min-h-0 flex-col gap-0", emptyList ? "shrink-0" : "flex-1")}>
            <TabsList className="mx-3 mt-2 grid h-8 w-auto shrink-0 grid-cols-2 bg-black/30">
              <TabsTrigger
                value="songs"
                className="text-white/80 not-data-active:hover:text-white hover:bg-white/10 data-active:bg-white data-active:text-neutral-950 data-active:hover:bg-white data-active:hover:text-neutral-950 data-active:shadow-none"
              >
                Songs
              </TabsTrigger>
              <TabsTrigger
                value="lists"
                className="text-white/80 not-data-active:hover:text-white hover:bg-white/10 data-active:bg-white data-active:text-neutral-950 data-active:hover:bg-white data-active:hover:text-neutral-950 data-active:shadow-none"
              >
                Playlists
              </TabsTrigger>
            </TabsList>
            <TabsContent value="songs" className={cn("flex min-h-0 flex-col overflow-hidden px-3 pt-2 pb-2", emptyList ? "flex-none" : "flex-1")}>
              {emptyList ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-3 text-left transition hover:bg-white/10"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black">
                    <Music2 className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">No songs yet</span>
                    <span className="mt-0.5 block text-xs text-white/60">Click to add a YouTube link</span>
                  </span>
                </button>
              ) : (
                <ScrollArea className="h-full px-2 [&_[data-slot=scroll-area-thumb]]:bg-white/25">
                  <div className="space-y-0.5 py-2">
                    {tracks.map((track, index) => {
                      const isCurrent = currentIndex === index;
                      const isLiked = liked?.trackIds.includes(track.id);
                      return (
                        <div
                          key={track.id}
                          className={cn(
                            "group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-200 ease-out",
                            isCurrent ? "bg-white/15" : "hover:bg-white/10"
                          )}
                          onClick={() => playTrack(index)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={track.cover} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm text-white", isCurrent && "font-semibold")}>
                              {track.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-white/75">{track.artist}</p>
                          </div>
                          <div
                            className="flex shrink-0 items-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={cn("rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white", isLiked && "text-white")}
                              onClick={() => toggleLiked(track.id)}
                            >
                              <Heart className={cn("size-3.5", isLiked && "fill-current")} />
                            </button>
                            <span className="w-10 text-right font-mono text-[11px] text-white/70">
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
        <TabsContent value="lists" className="min-h-0 overflow-hidden">
          <ScrollArea className="h-full px-3 py-2">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => {
                  setActivePlaylist(playlist.id);
                  setTab("songs");
                }}
                className={cn(
                  "mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-white/10",
                  playlist.id === activePlaylistId && "bg-white/15"
                )}
              >
                <span className="font-medium">{playlist.name}</span>
                <span className="text-xs text-white/70">{playlist.trackIds.length}</span>
              </button>
            ))}
          </ScrollArea>
        </TabsContent>
          </Tabs>

          <div className="flex shrink-0 items-center gap-3 border-t border-white/15 px-4 py-2 pr-5">
            <button
              type="button"
              className="shrink-0 text-white/90 transition hover:text-white"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setVolume(muted ? 80 : 0)}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
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
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-white">{volume}</span>
          </div>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Add more music
            </DialogTitle>
            <DialogDescription>Paste a YouTube link. Title and artist are optional.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSong} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>YouTube link</Label>
              <Input
                type="url"
                required
                placeholder="Paste YouTube link"
                value={ytUrl}
                onChange={(event) => setYtUrl(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Song title (optional)</Label>
              <Input
                placeholder="Song title"
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Artist (optional)</Label>
              <Input
                placeholder={user?.displayName}
                value={customArtist}
                onChange={(event) => setCustomArtist(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                <X data-icon="inline-start" />
                Cancel
              </Button>
              <Button type="submit">Add song</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newPlaylistOpen} onOpenChange={setNewPlaylistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingMode === "move" ? "Move to a new playlist" : "New playlist"}</DialogTitle>
            <DialogDescription>
              {pendingTrack
                ? pendingMode === "move"
                  ? `${pendingTrack.title} will move into this playlist.`
                  : `${pendingTrack.title} will be added to this playlist.`
                : "Name the playlist first."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="newPlaylistName">Playlist name</Label>
            <Input
              id="newPlaylistName"
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="Late night mix"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewPlaylistOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
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
