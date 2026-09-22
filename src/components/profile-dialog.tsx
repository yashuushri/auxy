"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { avatarInitials, isValidDisplayName } from "@/lib/storage";

const MAX_AVATAR_BYTES = 2_500_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [pronouns, setPronouns] = useState(user?.pronouns ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileUrl, setProfileUrl] = useState(`/u/${user?.username || ""}`);

  useEffect(() => {
    if (typeof window !== "undefined" && user?.username) {
      setProfileUrl(`${window.location.origin}/u/${user.username}`);
    }
  }, [user?.username]);

  useEffect(() => {
    if (user && open) {
      setDisplayName(user.displayName);
      setPronouns(user.pronouns ?? "");
      setBio(user.bio ?? "");
      setAvatar(user.avatar ?? "");
    }
  }, [user, open]);

  if (!user) return null;

  async function handleFileSelect(file?: File) {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Please choose a photo under 2.5MB.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatar(dataUrl);
      toast.success("Photo selected. Remember to save changes!");
    } catch {
      toast.error("Could not load selected photo.");
    }
  }

  function handleRemovePhoto() {
    setAvatar("");
    toast.info("Photo removed. Remember to save changes.");
  }

  function handleCopyProfileLink() {
    if (!user) return;
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/u/${encodeURIComponent(user.username)}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Public profile link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSave() {
    if (!user) return;
    const trimmedName = displayName.trim() || user.username;
    if (trimmedName.length > 50) {
      toast.error("Display name must be 50 characters or less.");
      return;
    }
    if (!isValidDisplayName(trimmedName)) {
      toast.error("Display name can only contain letters, numbers, and spaces.");
      return;
    }

    setSaving(true);
    try {
      await updateUser({
        displayName: trimmedName,
        pronouns: pronouns.trim(),
        bio: bio.trim(),
        avatar: avatar || "",
      });
      toast.success("Profile updated successfully!");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass-window !border-white/20 !bg-[#0a0a10]/80 !text-white backdrop-blur-2xl max-w-[calc(100%-1.5rem)] sm:max-w-[520px] max-h-[90dvh] flex flex-col rounded-2xl shadow-2xl p-4 sm:p-6 overflow-y-auto"
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
              Your profile
            </DialogTitle>
            <DialogDescription className="text-white/60 text-[13px] font-normal leading-normal">
              Manage your display name, pronouns, bio, avatar, and public page link.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Avatar and Identity Info */}
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/15 bg-white/5 p-3.5">
          {/* Circular Avatar with Hover Blur + Change Overlay + Bottom-Right Red Cross */}
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative size-16 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/40 transition-all cursor-pointer block focus:outline-none focus:ring-2 focus:ring-white/60"
              title="Click to change profile picture"
            >
              <Avatar className="size-full pointer-events-none">
                {avatar ? (
                  <AvatarImage
                    src={avatar}
                    alt={displayName || user.displayName}
                    className="size-full object-cover transition-all duration-300 group-hover:blur-[2px] group-hover:scale-105 group-hover:brightness-75"
                  />
                ) : null}
                <AvatarFallback className="bg-white/20 text-base font-semibold text-white size-full transition-all duration-300 group-hover:blur-[2px]">
                  {avatarInitials(displayName || user.displayName)}
                </AvatarFallback>
              </Avatar>

              {/* Centered change photo icon + text appearing on hover */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <Camera className="size-4 text-white drop-shadow-md" />
                <span className="text-[10px] font-medium text-white/95 drop-shadow mt-0.5 tracking-tight leading-none">
                  Change
                </span>
              </div>
            </button>

            {/* Red cross on bottom-right corner of avatar circle on hover to remove photo */}
            {avatar ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePhoto();
                }}
                title="Remove profile picture"
                aria-label="Remove profile picture"
                className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg ring-2 ring-[#0a0a10] cursor-pointer transition-all duration-200 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 hover:scale-110 z-10"
              >
                <X className="size-3 stroke-[2.5]" />
              </button>
            ) : null}
          </div>

          {/* Identity details */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                {displayName || user.displayName}
              </span>
              {pronouns && (
                <span className="text-xs text-white/50 font-normal truncate">
                  ({pronouns})
                </span>
              )}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                @{user.username}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/50 truncate">
              {user.email || "Registered account"}
            </p>
          </div>
        </div>

        {/* Input Fields */}
        <div className="mt-4 space-y-3.5">
          {/* Display Name with 50-character limit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="profile-display-name" className="block text-xs font-semibold text-white/80">
                Display Name
              </label>
              <span className="text-[11px] text-white/40">{displayName.length}/50</span>
            </div>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
              placeholder={user.username}
              maxLength={50}
              className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40"
            />
          </div>

          {/* Pronouns (added between Display Name and Bio) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="profile-pronouns" className="block text-xs font-semibold text-white/80">
                Pronouns
              </label>
              <span className="text-[11px] text-white/40">{pronouns.length}/30</span>
            </div>
            <input
              id="profile-pronouns"
              type="text"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value.slice(0, 30))}
              placeholder="e.g. they/them, he/him, she/her"
              maxLength={30}
              className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40"
            />
          </div>

          {/* Bio (Renamed from "Bio / Music Vibe") */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="profile-bio" className="block text-xs font-semibold text-white/80">
                Bio
              </label>
              <span className="text-[11px] text-white/40">{bio.length}/160</span>
            </div>
            <textarea
              id="profile-bio"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Tell everyone a little bit about yourself or your music taste..."
              className="w-full p-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 resize-none"
            />
          </div>

          {/* Public Profile URL Card */}
          <div className="rounded-xl border border-white/15 bg-white/5 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-white/70">Public profile link</span>
              <a
                href={profileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-white/70 hover:text-white hover:underline"
              >
                <span>View page</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={profileUrl}
                className="w-full h-8 px-2.5 rounded-lg border border-white/15 bg-black/30 text-xs text-white/80 font-mono select-all"
              />
              <button
                type="button"
                onClick={handleCopyProfileLink}
                className="shrink-0 h-8 px-3 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5 text-white/70" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void handleFileSelect(e.target.files?.[0])}
        />

        {/* Footer Actions */}
        <div className="border-t border-white/10 mt-5 pt-3.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 h-9 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-xl bg-white text-black hover:bg-white/90 font-semibold text-sm px-6 h-9 transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
