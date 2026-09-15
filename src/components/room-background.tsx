"use client";

import { useEffect, useState } from "react";
import { backgroundCss, getPresetById, DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { getStoredVideoUrl } from "@/lib/video-db";
import { AnimatedLiquidBackground } from "@/components/animated-liquid-background";
import type { Background, UserAccount } from "@/lib/types";

export function RoomBackground({
  user,
  background,
}: {
  user?: UserAccount | null;
  background?: Background | null;
}) {
  const bg = background || user?.background || DEFAULT_BACKGROUND;
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

  const isPreset = bg.kind === "preset";
  const activePreset = isPreset ? getPresetById(bg.value) : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#09090f]">
      {/* 1. Live Animated Liquid Shader for Presets */}
      {isPreset && activePreset && (
        <AnimatedLiquidBackground
          key={`liquid-bg-${activePreset.id}`}
          presetId={activePreset.id}
          className="transition-opacity duration-700 ease-out"
        />
      )}

      {/* 2. Color / Legacy gradient atmosphere */}
      {bg.kind === "color" && (
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: backgroundCss(bg.value),
          }}
        />
      )}

      {/* 3. Custom Image Backgrounds (URL or Upload) */}
      {(bg.kind === "url" || bg.kind === "upload") && (
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: backgroundCss(bg.value),
          }}
        />
      )}

      {/* 4. Looping Video (.mp4 / .webm) */}
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

      {/* 5. Minimal edge vignette for readability without any blur */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />
    </div>
  );
}
