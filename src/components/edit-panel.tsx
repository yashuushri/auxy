"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Headphones, Plus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { cn } from "@/lib/utils";
import { avatarInitials, isValidDisplayName } from "@/lib/storage";

const MAX_AVATAR_BYTES = 2_000_000;

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
  const [pronouns, setPronouns] = useState(user?.pronouns ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setPronouns(user.pronouns ?? "");
      setBio(user.bio ?? "");
    }
  }, [user]);

  if (!user) return null;

  async function onAvatar(file?: File) {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Keep the avatar under 2MB.");
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

  function copyProfileUrl() {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/u/${encodeURIComponent(user?.username || "")}`;
      navigator.clipboard.writeText(url);
      toast.success("Public profile link copied!");
    }
  }

  return (
    <div className="w-[320px] p-4 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar size="lg" className="size-14 ring-2 ring-white/25 after:hidden">
            <AvatarImage src={user.avatar} alt={user.displayName} />
            <AvatarFallback className="bg-[#16161f] text-sm font-semibold text-white">
              {avatarInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{user.displayName}</p>
            <p className="text-xs text-white/70">@{user.username}</p>
          </div>
        </div>

        <Link
          href={`/u/${user.username}`}
          target="_blank"
          className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          title="View Public Profile"
        >
          <ExternalLink className="size-4" />
        </Link>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-3 py-2.5">
        <Headphones className="mt-0.5 size-4 shrink-0 text-white/70" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-wider uppercase text-white/60">
            {isPlaying ? "Listening" : "Player"}
          </p>
          <p className="truncate text-sm font-medium">{currentTrack?.title ?? "Nothing playing"}</p>
          <p className="truncate text-xs text-white/70">{currentTrack?.artist ?? "Add YouTube song to play"}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-white text-xs">Playlists</Label>
          <span className="text-[10px] text-white/50">{playlists.length} total</span>
        </div>
        <div className="max-h-36 overflow-y-auto rounded-lg border border-white/20 divide-y divide-white/5">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => setActivePlaylist(playlist.id)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/10 transition-colors",
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
            className="border-white/25 bg-black/20 text-white placeholder:text-white/40 h-8 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="shrink-0 border-white/30 bg-black/20 text-white hover:bg-white/15 hover:text-white h-8 text-xs"
          >
            <Plus className="size-3.5 mr-1" />
            Add
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="displayName" className="text-white text-xs">
              Display name
            </Label>
            <span className="text-[10px] text-white/40">{displayName.length}/12</span>
          </div>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value.slice(0, 12))}
            maxLength={12}
            placeholder={user.username.slice(0, 12)}
            className="border-white/25 bg-black/20 text-white placeholder:text-white/40 h-8 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="pronouns" className="text-white text-xs">
              Pronouns
            </Label>
            <span className="text-[10px] text-white/40">{pronouns.length}/30</span>
          </div>
          <Input
            id="pronouns"
            value={pronouns}
            onChange={(event) => setPronouns(event.target.value.slice(0, 30))}
            maxLength={30}
            placeholder="e.g. they/them, he/him, she/her"
            className="border-white/25 bg-black/20 text-white placeholder:text-white/40 h-8 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="bio" className="text-white text-xs">
              Bio
            </Label>
            <span className="text-[10px] text-white/40">{bio.length}/160</span>
          </div>
          <Input
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 160))}
            maxLength={160}
            placeholder="A short note about your music taste"
            className="border-white/25 bg-black/20 text-white placeholder:text-white/40 h-8 text-xs"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/30 bg-black/20 text-white hover:bg-white/15 hover:text-white text-xs flex-1"
            onClick={() => avatarRef.current?.click()}
          >
            Change Photo
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-white text-black hover:bg-white/90 text-xs flex-1"
            onClick={() => {
              const name = displayName.trim() || user.username;
              if (name.length > 50) {
                toast.error("Display name must be 50 characters or less.");
                return;
              }
              if (!isValidDisplayName(name)) {
                toast.error("Display name can only contain letters, numbers, and spaces (no special characters like %$&@#).");
                return;
              }
              updateUser({ displayName: name, pronouns: pronouns.trim(), bio: bio.trim() });
              toast.success("Profile saved");
            }}
          >
            Save
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={copyProfileUrl}
          className="text-white/60 hover:text-white text-xs h-7 mt-1 flex items-center justify-center gap-1.5"
        >
          <Copy className="size-3" />
          <span>Copy Public Profile Link</span>
        </Button>

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
