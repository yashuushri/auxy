"use client";

import { useState } from "react";
import {
  Globe2,
  Headphones,
  ListMusic,
  Lock,
  LogOut,
  Music,
  Plus,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  Trash2,
  UserCheck,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { useListenTogether } from "@/context/listen-together-context";
import { usePlayer } from "@/context/player-context";
import { cn } from "@/lib/utils";

type SettingsTab = "playlists" | "player" | "listenTogether" | "account";

export function AppSettingsDialog({
  open,
  onOpenChange,
  onOpenProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRoom?: () => void;
  onOpenProfile?: () => void;
}) {
  const { user, logout } = useAuth();
  const {
    listenTogetherEnabled,
    privacy,
    updateSettings,
  } = useListenTogether();
  const {
    playlists,
    activePlaylistId,
    setActivePlaylist,
    createPlaylist,
    deletePlaylist,
    currentTrack,
    isPlaying,
    loopMode,
    toggleLoopMode,
    isShuffle,
    toggleShuffle,
    volume,
    setVolume,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<SettingsTab>("playlists");
  const [newPlaylistName, setNewPlaylistName] = useState("");

  if (!user) return null;

  function handleAddPlaylist(e: React.FormEvent) {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) {
      toast.error("Please enter a name for the playlist.");
      return;
    }
    createPlaylist(name, { activate: true });
    setNewPlaylistName("");
    toast.success(`Playlist "${name}" created!`);
  }

  function handleDeletePlaylist(id: string, name: string) {
    if (playlists.length <= 1) {
      toast.error("You need to keep at least one playlist.");
      return;
    }
    deletePlaylist(id);
    toast.info(`Deleted playlist "${name}"`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass-window !border-white/20 !bg-[#0a0a10]/80 !text-white backdrop-blur-2xl max-w-[calc(100%-1.5rem)] sm:max-w-[560px] max-h-[90dvh] flex flex-col rounded-2xl shadow-2xl p-4 sm:p-6 overflow-hidden"
      >
        {/* Header with Title, Description, and Close 'X' Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="absolute -top-1 -right-1 p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="size-5 stroke-[2]" />
          </button>

          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Settings
            </DialogTitle>
            <DialogDescription className="text-white/60 text-[13px] font-normal leading-normal">
              Manage your playlists, player controls, listening session, and account.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tab Buttons */}
        <div className="mt-3.5 flex border-b border-white/10 gap-1 pb-1 overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("playlists")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === "playlists"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <ListMusic className="size-3.5" />
            Playlists
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("player")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === "player"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Headphones className="size-3.5" />
            Player & Audio
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("listenTogether")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === "listenTogether"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Radio className="size-3.5" />
            Listen Together
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === "account"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <UserRound className="size-3.5" />
            Account
          </button>
        </div>

        {/* Tab 1: Playlists & Edit */}
        {activeTab === "playlists" && (
          <div className="mt-3.5 space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white/80">Your Playlists</span>
                <span className="text-[11px] text-white/50 font-medium">
                  {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
                </span>
              </div>

              {/* Playlists List */}
              <div className="max-h-44 overflow-y-auto rounded-xl border border-white/15 divide-y divide-white/10 bg-white/5">
                {playlists.map((playlist) => {
                  const isActive = playlist.id === activePlaylistId;
                  return (
                    <div
                      key={playlist.id}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-sm transition-colors",
                        isActive ? "bg-white/15 text-white font-medium" : "hover:bg-white/10 text-white/80"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActivePlaylist(playlist.id);
                          toast.success(`Active playlist set to "${playlist.name}"`);
                        }}
                        className="flex-1 flex items-center gap-2 text-left truncate cursor-pointer mr-2"
                      >
                        <Music className={cn("size-3.5 shrink-0", isActive ? "text-white" : "text-white/50")} />
                        <span className="truncate">{playlist.name}</span>
                        {isActive && (
                          <span className="rounded-full bg-white text-black px-1.5 py-0.2 text-[10px] font-semibold ml-1 shrink-0">
                            Active
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-white/50 font-mono">
                          {playlist.trackIds.length} {playlist.trackIds.length === 1 ? "track" : "tracks"}
                        </span>
                        {playlists.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeletePlaylist(playlist.id, playlist.name)}
                            title="Delete playlist"
                            className="p-1 rounded-md text-white/50 hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create New Playlist Form */}
            <form onSubmit={handleAddPlaylist} className="flex gap-2">
              <input
                type="text"
                placeholder="New playlist title..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 h-9 px-3 rounded-xl border border-white/15 bg-white/5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40"
              />
              <button
                type="submit"
                className="h-9 px-3.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="size-3.5" />
                <span>Create</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Player & Audio */}
        {activeTab === "player" && (
          <div className="mt-3.5 space-y-4">
            {/* Current Playing Preview */}
            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-white shrink-0">
                <Music className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    {isPlaying ? "Currently Playing" : "Playback"}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold text-white">
                  {currentTrack?.title || "No track active"}
                </p>
                <p className="truncate text-xs text-white/50">
                  {currentTrack?.artist || "Pick or search a song in the player"}
                </p>
              </div>
            </div>

            {/* Volume slider */}
            <div className="rounded-xl border border-white/15 p-3 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                  <Volume2 className="size-3.5 text-white/70" />
                  Player Volume
                </span>
                <span className="text-xs font-mono text-white/60">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-white cursor-pointer h-1.5 bg-white/20 rounded-lg"
              />
            </div>

            {/* Loop & Shuffle Controls */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={toggleLoopMode}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                  loopMode !== "off"
                    ? "border-white bg-white text-black"
                    : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                )}
              >
                <span className="flex items-center gap-2">
                  {loopMode === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
                  <span>Loop Mode</span>
                </span>
                <span className="text-[11px] font-normal uppercase opacity-80">{loopMode}</span>
              </button>

              <button
                type="button"
                onClick={toggleShuffle}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                  isShuffle
                    ? "border-white bg-white text-black"
                    : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                )}
              >
                <span className="flex items-center gap-2">
                  <Shuffle className="size-4" />
                  <span>Shuffle</span>
                </span>
                <span className="text-[11px] font-normal uppercase opacity-80">{isShuffle ? "On" : "Off"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Listen Together Settings */}
        {activeTab === "listenTogether" && (
          <div className="mt-3.5 space-y-3">
            {/* Master Toggle Card */}
            <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 p-3.5">
              <div>
                <span className="text-xs font-bold text-white block">Listen Together</span>
                <span className="text-[11px] text-white/50">
                  Allow other listeners to sync audio playback in real time.
                </span>
              </div>

              {/* Minimal Clean Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={listenTogetherEnabled}
                  onChange={(e) =>
                    updateSettings({ listenTogetherEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-white peer-checked:after:bg-black"></div>
              </label>
            </div>

            {listenTogetherEnabled ? (
              <>
                {/* Privacy Mode Card */}
                <div className="rounded-xl border border-white/15 bg-white/5 p-3.5 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Privacy Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => updateSettings({ privacy: "friends" })}
                      className={cn(
                        "flex flex-col gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer",
                        privacy === "friends"
                          ? "border-white bg-white text-black"
                          : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="size-3.5" />
                        <span className="text-xs font-semibold">Friends Only</span>
                      </div>
                      <span
                        className={cn(
                          "text-[11px] leading-tight",
                          privacy === "friends" ? "text-neutral-600" : "text-white/50"
                        )}
                      >
                        Friends can request to join
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSettings({ privacy: "public" })}
                      className={cn(
                        "flex flex-col gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer",
                        privacy === "public"
                          ? "border-white bg-white text-black"
                          : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Globe2 className="size-3.5" />
                        <span className="text-xs font-semibold">Public</span>
                      </div>
                      <span
                        className={cn(
                          "text-[11px] leading-tight",
                          privacy === "public" ? "text-neutral-600" : "text-white/50"
                        )}
                      >
                        Anyone can request to join
                      </span>
                    </button>
                  </div>
                </div>

                {/* Join Approval Card - Manual approval only */}
                <div className="rounded-xl border border-white/15 bg-white/5 p-3.5 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Join Approval
                  </span>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/20 bg-white/5 text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
                        <UserCheck className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Manual Approval</span>
                        <span className="text-[11px] text-white/50 leading-tight">
                          Requests require your confirmation before joining
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/15 bg-white/5 p-3.5 text-center text-xs text-white/50">
                Listen Together is turned off. Other users cannot request to join your playback.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Account */}
        {activeTab === "account" && (
          <div className="mt-3.5 space-y-3.5">
            <div className="rounded-xl border border-white/15 bg-white/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">{user.displayName}</span>
                  <span className="text-xs text-white/50">@{user.username}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    if (onOpenProfile) onOpenProfile();
                  }}
                  className="px-3 py-1 rounded-lg border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20 transition-colors cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              <div className="border-t border-white/10 pt-2 text-xs text-white/60 flex justify-between">
                <span>Account Email</span>
                <span className="font-mono text-white/80">{user.email || "—"}</span>
              </div>
            </div>

            <div className="border border-red-500/30 rounded-xl p-3 bg-red-500/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-red-300 block">Log out of Auxy</span>
                <span className="text-[11px] text-red-400">End your current session on this device.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  logout();
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="size-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 mt-5 pt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-white text-black hover:bg-white/90 font-semibold text-sm px-6 h-9 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
