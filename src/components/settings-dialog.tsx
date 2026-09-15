"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Video, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { ROOM_PRESETS } from "@/lib/backgrounds";
import { isLightColor } from "@/lib/contrast";
import { storeVideoFile } from "@/lib/video-db";
import type { Background } from "@/lib/types";

const MAX_IMAGE_BYTES = 4_500_000;

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, updateUser } = useAuth();
  const [color, setColor] = useState(
    user?.background.kind === "color" ? user.background.value : "#0b0b12"
  );
  const [imageUrl, setImageUrl] = useState(
    user?.background.kind === "url" ? user.background.value : ""
  );
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const colorTimer = useRef<number | null>(null);

  if (!user) return null;

  const colorIsLight = isLightColor(color);

  function setBackground(background: Background) {
    updateUser({ background });
  }

  function onColorPick(next: string) {
    setColor(next);
    if (colorTimer.current) window.clearTimeout(colorTimer.current);
    colorTimer.current = window.setTimeout(() => {
      setBackground({ kind: "color", value: next });
    }, 50);
  }

  function onImageFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Please keep the image under 4.5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setBackground({ kind: "upload", value: dataUrl });
      toast.success("Photo background updated");
    };
    reader.onerror = () => toast.error("Could not load image");
    reader.readAsDataURL(file);
  }

  async function onVideoFile(file?: File) {
    if (!file) return;
    try {
      setUploadPercent(0);
      const videoKey = await storeVideoFile(file, (percent) => {
        setUploadPercent(percent);
      });
      setBackground({ kind: "video", value: videoKey });
      toast.success("Looping video background active");
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy video. Please try another file.");
    } finally {
      setTimeout(() => setUploadPercent(null), 800);
    }
  }

  function applyImageLink() {
    const next = imageUrl.trim();
    if (!next) {
      toast.error("Paste an image link first.");
      return;
    }
    if (!/^https?:\/\//i.test(next)) {
      toast.error("Please enter a valid URL starting with https://");
      return;
    }
    setBackground({ kind: "url", value: next });
    toast.success("Image link applied");
  }

  // Determine current color preview for Card 3
  const cardColorBg =
    user.background.kind === "color"
      ? user.background.value
      : user.background.kind === "preset"
      ? user.background.value
      : color || "#0b0b12";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-white text-neutral-900 border-none sm:max-w-[540px] rounded-2xl shadow-2xl p-6 overflow-hidden"
      >
        {/* Header with Title, Description, and Close 'X' Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="absolute -top-1 -right-1 p-1 rounded-full text-neutral-700 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="size-5 stroke-[2]" />
          </button>

          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight text-neutral-900">
              Your room
            </DialogTitle>
            <DialogDescription className="text-neutral-500 text-[13px] font-normal leading-normal">
              This is the blank page behind the player. Add a looping .mp4, a still image, or a color.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* 3 Top Action Cards */}
        <div className="grid grid-cols-3 gap-3.5 mt-4">
          {/* Card 1: Replace .mp4 */}
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="relative flex flex-col items-center justify-center rounded-2xl bg-black text-white p-3 h-[130px] cursor-pointer hover:bg-neutral-900 transition-all select-none group text-center"
          >
            <Video className="size-6 text-white mb-2 stroke-[1.8]" />
            <span className="text-sm font-bold text-white tracking-tight leading-snug">
              {uploadPercent !== null ? `Copying ${uploadPercent}%` : "Replace .mp4"}
            </span>
            <span className="text-xs text-neutral-400 font-normal mt-0.5">
              {uploadPercent !== null ? "Saving to account" : "Silent loop"}
            </span>
          </button>

          {/* Card 2: Upload image */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="relative flex flex-col items-center justify-center rounded-2xl bg-white border border-neutral-200/90 text-neutral-900 p-3 h-[130px] cursor-pointer hover:bg-neutral-50 hover:border-neutral-300 transition-all select-none shadow-xs group text-center"
          >
            <ImagePlus className="size-6 text-neutral-800 mb-2 stroke-[1.8]" />
            <span className="text-sm font-bold text-neutral-900 tracking-tight leading-snug">
              Upload image
            </span>
            <span className="text-xs text-neutral-400 font-normal mt-0.5">Still photo</span>
          </button>

          {/* Card 3: Color picker */}
          <label
            className="relative flex flex-col justify-end rounded-2xl p-3.5 h-[130px] cursor-pointer transition-all overflow-hidden select-none ring-1 ring-black/10 hover:ring-black/20 shadow-xs"
            style={{ background: cardColorBg }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => onColorPick(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div className="relative z-10 pointer-events-none">
              <span
                className={`block text-sm font-bold tracking-tight leading-snug ${
                  colorIsLight && user.background.kind === "color"
                    ? "text-neutral-900"
                    : "text-white drop-shadow-xs"
                }`}
              >
                Color
              </span>
              <span
                className={`block text-xs font-normal mt-0.5 ${
                  colorIsLight && user.background.kind === "color"
                    ? "text-neutral-700"
                    : "text-neutral-300 drop-shadow-xs"
                }`}
              >
                Click to pick
              </span>
            </div>
          </label>
        </div>

        {/* Subtitle / note below the 3 cards */}
        <p className="text-xs text-neutral-500 font-normal mt-3.5 mb-3 leading-relaxed">
          Photos save instantly. A looping video is larger, so a percent will show while it copies to your account.
        </p>

        {/* 5 Presets Row: Midnight, Forest, Ember, Ocean, Violet */}
        <div className="grid grid-cols-5 gap-2.5 mb-4">
          {ROOM_PRESETS.map((preset) => {
            const active =
              user.background.kind === "preset" && user.background.value === preset.value;
            return (
              <div key={preset.id} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setBackground({ kind: "preset", value: preset.value })}
                  title={preset.name}
                  className={`w-full h-11 rounded-xl transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${
                    active ? "ring-2 ring-black ring-offset-2 scale-[1.02]" : "ring-1 ring-black/10"
                  }`}
                  style={{ background: preset.value }}
                />
                <span className="text-xs text-neutral-600 font-medium mt-1.5 text-center truncate w-full">
                  {preset.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Image Link Section */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label
            htmlFor="room-image-link-input"
            className="text-xs font-bold text-neutral-800"
          >
            Image link
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
              <input
                id="room-image-link-input"
                type="url"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyImageLink();
                  }
                }}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
              />
            </div>
            <button
              type="button"
              onClick={applyImageLink}
              className="h-10 px-4 rounded-xl font-semibold text-sm text-neutral-800 hover:text-black hover:bg-neutral-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              Use link
            </button>
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onImageFile(e.target.files?.[0])}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm"
          hidden
          onChange={(e) => void onVideoFile(e.target.files?.[0])}
        />

        {/* Footer with Done button */}
        <div className="border-t border-neutral-100 mt-5 pt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-sm px-6 h-9 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
