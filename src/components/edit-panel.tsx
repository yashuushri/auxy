"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Plus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { cn } from "@/lib/utils";
import { avatarInitials } from "@/lib/storage";

const MAX_AVATAR_BYTES = 1_400_000;

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function EditPanel() {
  const { user, updateUser } = useAuth();
  const { currentTrack, isPlaying, playlists, createPlaylist, setActivePlaylist, activePlaylistId } =
    usePlayer();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) setDisplayName(user.displayName);
  }, [user]);

  if (!user) return null;

  async function onAvatar(file?: File) {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Keep the avatar under 1.4MB.");
      return;
    }
    updateUser({ avatar: await readFile(file) });
    toast.success("Avatar updated");
  }

  function addPlaylist() {
    const name = newPlaylistName.trim();
    if (!name) {
      toast.error("Name the playlist first.");
      return;
    }
    createPlaylist(name, { activate: false });
    setNewPlaylistName("");
  }

  return (
    <div className="w-[320px] p-4">
      <div className="mb-4 flex items-center gap-3">
        <Avatar size="lg" className="size-14 ring-2 ring-white/25 after:hidden">
          <AvatarImage src={user.avatar} alt={user.displayName} />
          <AvatarFallback className="bg-[#16161f] text-sm font-semibold text-white">
            {avatarInitials(user.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{user.displayName}</p>
          <p className="text-xs text-white/70">@{user.username}</p>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/20 px-3 py-2.5">
        <Headphones className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-wider uppercase">
            {isPlaying ? "Listening" : "Player"}
          </p>
          <p className="truncate text-sm font-medium">{currentTrack?.title ?? "Nothing playing"}</p>
          <p className="truncate text-xs text-white/70">{currentTrack?.artist ?? "Add a song to play"}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <Label className="text-white">Playlists</Label>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-white/20">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => setActivePlaylist(playlist.id)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/10",
                playlist.id === activePlaylistId && "bg-white/15"
              )}
            >
              <span className="truncate text-sm font-medium">{playlist.name}</span>
              <span className="ml-2 shrink-0 text-[11px] text-white/60">{playlist.trackIds.length}</span>
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addPlaylist();
          }}
        >
          <Input
            value={newPlaylistName}
            onChange={(event) => setNewPlaylistName(event.target.value)}
            placeholder="New playlist name"
            className="border-white/25 bg-black/20 text-white placeholder:text-white/40"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="shrink-0 border-white/30 bg-black/20 text-white hover:bg-white/15 hover:text-white"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName" className="text-white">
            Display name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={user.username}
            className="border-white/25 bg-black/20 text-white placeholder:text-white/40"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/30 bg-black/20 text-white hover:bg-white/15 hover:text-white"
            onClick={() => avatarRef.current?.click()}
          >
            Upload photo
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const name = displayName.trim() || user.username;
              updateUser({ displayName: name });
              toast.success("Display name updated");
            }}
          >
            Save
          </Button>
        </div>
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void onAvatar(event.target.files?.[0])}
        />
      </div>
    </div>
  );
}
