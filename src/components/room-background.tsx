"use client";

import { useEffect, useState } from "react";
import { backgroundCss } from "@/lib/backgrounds";
import { getStoredVideoUrl } from "@/lib/video-db";
import type { UserAccount } from "@/lib/types";

export function RoomBackground({ user }: { user: UserAccount }) {
  const bg = user.background;
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setVideoLoaded(false);

    if (bg.kind === "video") {
      if (bg.value.startsWith("indexeddb:")) {
        getStoredVideoUrl().then((url) => {
          if (active && url) {
            setVideoSrc(url);
          }
        });
      } else if (bg.value) {
        setVideoSrc(bg.value);
      }
    } else {
      setVideoSrc(null);
    }

    return () => {
      active = false;
    };
  }, [bg.kind, bg.value]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#09090f]">
      {/* 1. Base ambient atmosphere */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          background:
            bg.kind === "preset" || bg.kind === "color"
              ? backgroundCss(bg.value)
              : "linear-gradient(160deg, #0b0b12 0%, #1b1230 48%, #0d1b2a 100%)",
        }}
      />

      {/* 2. Custom Image Backgrounds (URL or Upload) */}
      {(bg.kind === "url" || bg.kind === "upload") && (
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: backgroundCss(bg.value),
          }}
        />
      )}

      {/* 3. Looping Video (.mp4 / .webm) */}
      {bg.kind === "video" && videoSrc && (
        <div className="absolute inset-0 overflow-hidden">
          <video
            key={videoSrc}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
            onCanPlay={() => setVideoLoaded(true)}
            className={`size-full object-cover transition-opacity duration-700 ease-in-out ${
              videoLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      )}

      {/* 4. Subtle Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50 pointer-events-none" />
      <div className="absolute inset-0 bg-black/15 backdrop-blur-[0.5px] pointer-events-none" />
    </div>
  );
}
