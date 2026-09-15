"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { backgroundCss } from "@/lib/backgrounds";
import {
  cloudVideoMeta,
  downloadRoomVideo,
  loadRoomVideo,
  saveRoomVideo,
  uploadRoomVideo,
  VIDEO_DOWNLOAD_TOAST,
  VIDEO_UPLOAD_TOAST,
} from "@/lib/room-media";
import type { UserAccount } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function RoomBackground({ user }: { user: UserAccount }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadPercent, setLoadPercent] = useState(0);
  const [loadNote, setLoadNote] = useState("Loading room video…");

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (user.background.kind !== "video") {
      setVideoUrl(null);
      setLoadPercent(0);
      return;
    }

    const stamp = user.background.value;

    function showVideo(blob: Blob) {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setVideoUrl(url);
    }

    async function resolveVideo() {
      setLoadNote("Loading room video…");
      setLoadPercent(8);

      let blob = await loadRoomVideo(user.username);
      if (blob) {
        showVideo(blob);
        const meta = await cloudVideoMeta().catch(() => ({ exists: false as const }));
        if (!cancelled && (!meta.exists || meta.stamp !== stamp)) {
          toast.loading("Saving room video… 1%", {
            id: VIDEO_UPLOAD_TOAST,
            description: "This can take a minute. Keep this page open so other browsers can load it.",
            duration: Infinity,
          });
          try {
            await uploadRoomVideo(blob, stamp, (percent) => {
              toast.loading(`Saving room video… ${percent}%`, {
                id: VIDEO_UPLOAD_TOAST,
                description: "This can take a minute. Keep this page open so other browsers can load it.",
                duration: Infinity,
              });
            });
            if (!cancelled) {
              toast.success("Room video saved.", {
                id: VIDEO_UPLOAD_TOAST,
                description: "Other browsers can load it now.",
                duration: 15_000,
              });
            }
          } catch {
            if (!cancelled) toast.error("Could not save that video.", { id: VIDEO_UPLOAD_TOAST, duration: 15_000 });
          }
        }
        return;
      }

      const deadline = Date.now() + 8 * 60 * 1000;
      while (!cancelled && Date.now() < deadline) {
        const meta = await cloudVideoMeta().catch(() => ({ exists: false as const }));
        if (cancelled) return;

        if (!meta.exists) {
          setLoadNote("Waiting for the video to finish saving…");
          setLoadPercent((prev) => (prev < 12 ? 12 : prev));
          toast.loading("Waiting for your room video…", {
            id: VIDEO_DOWNLOAD_TOAST,
            description: "It is still uploading from your other browser. This can take a minute.",
            duration: Infinity,
          });
          await sleep(2500);
          continue;
        }

        setLoadNote("Downloading room video…");
        toast.loading("Loading room video… 1%", {
          id: VIDEO_DOWNLOAD_TOAST,
          description: "First load on a new browser can take a minute. After that it stays here.",
          duration: Infinity,
        });
        try {
          blob = await downloadRoomVideo((percent) => {
            if (cancelled) return;
            setLoadPercent(percent);
            toast.loading(`Loading room video… ${percent}%`, {
              id: VIDEO_DOWNLOAD_TOAST,
              description: "First load on a new browser can take a minute. After that it stays here.",
              duration: Infinity,
            });
          });
        } catch {
          blob = null;
        }

        if (blob) {
          await saveRoomVideo(
            user.username,
            new File([blob], "room.mp4", { type: blob.type || "video/mp4" })
          ).catch(() => undefined);
          if (!cancelled) {
            toast.success("Room video loaded.", { id: VIDEO_DOWNLOAD_TOAST, duration: 15_000 });
            showVideo(blob);
          }
          return;
        }

        setLoadNote("Still loading the room video…");
        await sleep(2500);
      }

      if (!cancelled) {
        toast.error("Could not load that room video yet. Refresh in a moment.", {
          id: VIDEO_DOWNLOAD_TOAST,
          duration: 15_000,
        });
      }
    }

    void resolveVideo();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user.username, user.background.kind, user.background.value]);

  if (user.background.kind === "video" && videoUrl) {
    return (
      <video
        className="pointer-events-none absolute inset-0 size-full object-cover"
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
    );
  }

  if (user.background.kind === "video") {
    return (
      <div className="absolute inset-0 bg-black">
        <div className="absolute bottom-8 left-1/2 w-[min(92%,22rem)] -translate-x-1/2 rounded-xl bg-white/10 px-4 py-3 text-center text-white backdrop-blur-sm">
          <p className="text-sm font-medium">{loadNote}</p>
          <p className="mt-1 text-[11px] leading-4 text-white/70">
            This is normal for a large file. Keep this page open.
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-200"
              style={{ width: `${Math.max(6, loadPercent)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] tabular-nums text-white/80">{Math.max(1, loadPercent)}%</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0"
      style={{ background: backgroundCss(user.background.value) }}
    />
  );
}
