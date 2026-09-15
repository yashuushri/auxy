"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Video } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { BACKGROUND_PRESETS } from "@/lib/backgrounds";
import { isLightColor } from "@/lib/contrast";
import {
  deleteCloudVideo,
  deleteRoomVideo,
  isMp4File,
  saveRoomVideo,
  uploadRoomVideo,
  VIDEO_UPLOAD_TOAST,
} from "@/lib/room-media";
import { cn } from "@/lib/utils";
import type { Background } from "@/lib/types";

const MAX_IMAGE_BYTES = 1_400_000;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const COLOR_PRESETS = BACKGROUND_PRESETS.filter((preset) => !preset.value.startsWith("url("));

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

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
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoPercent, setVideoPercent] = useState(0);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const colorTimer = useRef<number | null>(null);
  const lastBackground = useRef<string | null>(null);

  if (!user) return null;
  const currentUser = user;
  const username = currentUser.username;
  const colorIsLight = isLightColor(color);

  async function setBackground(background: Background) {
    const key = `${background.kind}:${background.value}`;
    if (
      lastBackground.current === key ||
      (currentUser.background.kind === background.kind &&
        currentUser.background.value === background.value)
    ) {
      return;
    }
    lastBackground.current = key;
    if (currentUser.background.kind === "video" && background.kind !== "video") {
      await deleteRoomVideo(username).catch(() => undefined);
      await deleteCloudVideo();
    }
    updateUser({ background });
  }

  function onColorPick(next: string) {
    setColor(next);
    if (colorTimer.current) window.clearTimeout(colorTimer.current);
    colorTimer.current = window.setTimeout(() => {
      void setBackground({ kind: "color", value: next });
    }, 80);
  }

  async function onImageFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Keep the image under 1.4MB.");
      return;
    }
    await setBackground({ kind: "upload", value: await readFile(file) });
    toast.success("Background image updated");
  }

  async function onVideoFile(file?: File) {
    if (!file) return;
    if (!isMp4File(file)) {
      toast.error("Only .mp4 videos work. Other files will not play.");
      if (videoRef.current) videoRef.current.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Keep the video under 50MB.");
      return;
    }
    setSavingVideo(true);
    setVideoPercent(1);
    const stamp = `${file.name}:${Date.now()}`;
    toast.loading("Saving room video… 1%", {
      id: VIDEO_UPLOAD_TOAST,
      description: "This can take a minute. Keep this page open so other browsers can load it.",
      duration: Infinity,
    });
    try {
      await saveRoomVideo(username, file);
      updateUser({ background: { kind: "video", value: stamp } });
      await uploadRoomVideo(file, stamp, (percent) => {
        setVideoPercent(percent);
        toast.loading(`Saving room video… ${percent}%`, {
          id: VIDEO_UPLOAD_TOAST,
          description: "This can take a minute. Keep this page open so other browsers can load it.",
          duration: Infinity,
        });
      });
      toast.success("Room video saved.", {
        id: VIDEO_UPLOAD_TOAST,
        description: "Other browsers can load it now.",
        duration: 15_000,
      });
    } catch {
      toast.error("Could not save that video.", { id: VIDEO_UPLOAD_TOAST, duration: 15_000 });
    } finally {
      setSavingVideo(false);
      setVideoPercent(0);
      if (videoRef.current) videoRef.current.value = "";
    }
  }

  async function applyImageLink() {
    const next = imageUrl.trim();
    if (!next) {
      toast.error("Paste an image link first.");
      return;
    }
    if (!/^https?:\/\//i.test(next)) {
      toast.error("Use a link that starts with https://");
      return;
    }
    await setBackground({ kind: "url", value: next });
    toast.success("Background image link set");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && savingVideo) {
          toast.message("Video is still saving in the background. Keep this page open.", {
            duration: 15_000,
          });
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="bg-white text-neutral-950 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Your room</DialogTitle>
          <DialogDescription className="text-neutral-500">
            This is the blank page behind the player. Add a looping .mp4, a still image, or a color.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-stretch gap-3">
          <button
            type="button"
            disabled={savingVideo}
            onClick={() => videoRef.current?.click()}
            className="flex h-28 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl bg-black text-white hover:bg-black/90 disabled:opacity-60"
          >
            <Video className="size-5" />
            <span className="text-sm font-medium">
              {savingVideo
                ? `${videoPercent || 1}%`
                : user.background.kind === "video"
                  ? "Replace .mp4"
                  : "Upload .mp4"}
            </span>
            <span className="text-[11px] text-white/60">
              {savingVideo ? "Saving to your account" : "Silent loop"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => imageRef.current?.click()}
            className="flex h-28 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50"
          >
            <ImagePlus className="size-5" />
            <span className="text-sm font-medium">Upload image</span>
            <span className="text-[11px] text-neutral-400">Still photo</span>
          </button>

          <label
            className="relative h-28 min-w-0 flex-[1.4] cursor-pointer overflow-hidden rounded-xl ring-1 ring-neutral-200"
            style={{ background: color }}
          >
            <input
              type="color"
              value={color}
              onChange={(event) => onColorPick(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <span className="pointer-events-none absolute inset-x-2.5 bottom-2.5">
              <span
                className={cn("block text-sm font-medium", colorIsLight ? "text-neutral-950" : "text-white drop-shadow")}
              >
                Color
              </span>
              <span
                className={cn("block text-[11px]", colorIsLight ? "text-neutral-700" : "text-white/70 drop-shadow")}
              >
                Click to pick
              </span>
            </span>
          </label>
        </div>

        {savingVideo ? (
          <div className="rounded-lg bg-neutral-100 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-700">
              <span>Uploading room video</span>
              <span className="tabular-nums font-medium">{videoPercent || 1}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-black transition-[width] duration-200"
                style={{ width: `${Math.max(2, videoPercent)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-4 text-neutral-500">
              This can take a minute on a large file. Keep this page open. Your room already plays it here; other
              browsers will see it after this bar finishes.
            </p>
          </div>
        ) : (
          <p className="text-[11px] leading-4 text-neutral-500">
            Photos save instantly. A looping video is larger, so a percent will show while it copies to your account.
          </p>
        )}

        <div className="grid grid-cols-5 gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => void setBackground({ kind: "preset", value: preset.value })}
              className="group min-w-0 text-left"
            >
              <span
                className={cn(
                  "block h-9 rounded-lg ring-1 ring-neutral-200 group-hover:ring-neutral-400",
                  user.background.kind === "preset" &&
                    user.background.value === preset.value &&
                    "ring-2 ring-neutral-950"
                )}
                style={{ background: preset.value }}
              />
              <span className="mt-1 block truncate text-center text-[11px] text-neutral-500">
                {preset.name}
              </span>
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void applyImageLink();
          }}
        >
          <Label htmlFor="room-image-url" className="text-neutral-700">
            Image link
          </Label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                id="room-image-url"
                type="url"
                placeholder="https://..."
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                className="border-neutral-200 bg-white pl-8 text-neutral-950 placeholder:text-neutral-400"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="shrink-0 border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50"
            >
              Use link
            </Button>
          </div>
        </form>

        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,.mp4"
          hidden
          onChange={(event) => void onVideoFile(event.target.files?.[0])}
        />
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void onImageFile(event.target.files?.[0])}
        />

        <DialogFooter className="border-neutral-200 bg-neutral-50">
          <Button type="button" className="bg-black text-white hover:bg-black/90" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
