"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  backgroundCss,
  getPresetById,
  DEFAULT_BACKGROUND,
  LIVE_SHADERS,
  resolveLiveShader,
} from "@/lib/backgrounds";
import { getRoomMedia } from "@/lib/media-storage";
import { AnimatedLiquidBackground } from "@/components/animated-liquid-background";
import type { Background, UserAccount } from "@/lib/types";

interface VideoSlot {
  src: string;
  poster?: string;
}

function RoomBackgroundComponent({
  user,
  background,
}: {
  user?: UserAccount | null;
  background?: Background | null;
}) {
  const bg = background || user?.background || DEFAULT_BACKGROUND;
  const [resolvedValue, setResolvedValue] = useState<string>(bg.value || "");

  // Dual-slot crossfade state: slotA and slotB
  const [slotA, setSlotA] = useState<VideoSlot | null>(null);
  const [slotB, setSlotB] = useState<VideoSlot | null>(null);
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [isSlotALoaded, setIsSlotALoaded] = useState(false);
  const [isSlotBLoaded, setIsSlotBLoaded] = useState(false);

  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Resolve IndexedDB reference or raw URL
  useEffect(() => {
    let active = true;
    if (bg.value && bg.value.startsWith("indexeddb:")) {
      const mediaId = bg.value.replace("indexeddb:", "");
      getRoomMedia(mediaId).then((res) => {
        if (active && res?.url) {
          setResolvedValue(res.url);
        }
      });
    } else {
      setResolvedValue(bg.value || "");
    }
    return () => {
      active = false;
    };
  }, [bg.value]);

  const isVideoMedia =
    bg.kind === "video" ||
    bg.mediaType === "video" ||
    (bg.kind === "upload" &&
      (resolvedValue.startsWith("data:video") ||
        resolvedValue.endsWith(".mp4") ||
        resolvedValue.endsWith(".webm") ||
        (bg.name && /\.(mp4|webm|mov|mkv)$/i.test(bg.name))));

  const isPreset = bg.kind === "preset";
  const activePreset = isPreset ? getPresetById(bg.value) : null;
  const matchedShader = resolveLiveShader(bg);
  const effectivePoster =
    bg.posterUrl || matchedShader?.posterUrl || LIVE_SHADERS[0]?.posterUrl || "";

  const activeSrcRef = useRef<string>("");
  const stagedSrcRef = useRef<string>("");

  // Helper to safely unload a video element and free decoder memory
  const releaseVideoElement = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch {}
  }, []);

  // 2. Video Source Management with Zero-Flash Seamless Handover
  useEffect(() => {
    if (!isVideoMedia || !resolvedValue) {
      // Not video - cleanly release both video elements
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      activeSrcRef.current = "";
      stagedSrcRef.current = "";
      releaseVideoElement(videoRefA.current);
      releaseVideoElement(videoRefB.current);
      setSlotA(null);
      setSlotB(null);
      setIsSlotALoaded(false);
      setIsSlotBLoaded(false);
      return;
    }

    let targetSrc = resolvedValue;
    if (
      !resolvedValue.startsWith("blob:") &&
      !resolvedValue.startsWith("data:") &&
      bg.mediaType !== "video"
    ) {
      const matched = resolveLiveShader({ kind: bg.kind, value: bg.value, name: bg.name, mediaType: bg.mediaType });
      if (matched?.url) {
        targetSrc = matched.url;
      }
    }

    // Check if target is already active or currently being staged
    if (activeSrcRef.current === targetSrc || stagedSrcRef.current === targetSrc) {
      return;
    }

    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    stagedSrcRef.current = targetSrc;

    // Initial mount: load into slot A
    if (!activeSrcRef.current) {
      activeSrcRef.current = targetSrc;
      setSlotA({ src: targetSrc, poster: effectivePoster });
      setActiveSlot("A");
      setIsSlotALoaded(false);
      return;
    }

    // Handover to the other slot
    if (activeSlot === "A") {
      // Stage slot B
      setSlotB({ src: targetSrc, poster: effectivePoster });
      setIsSlotBLoaded(false);
    } else {
      // Stage slot A
      setSlotA({ src: targetSrc, poster: effectivePoster });
      setIsSlotALoaded(false);
    }
  }, [bg.mediaType, bg.kind, bg.value, bg.name, isVideoMedia, resolvedValue, activeSlot, effectivePoster, releaseVideoElement]);

  // Handle Slot A ready to display
  const handleSlotAReady = useCallback(() => {
    setIsSlotALoaded(true);
    if (activeSlot === "B") {
      activeSrcRef.current = stagedSrcRef.current;
      setActiveSlot("A");
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        releaseVideoElement(videoRefB.current);
        setSlotB(null);
        setIsSlotBLoaded(false);
      }, 600);
    }
  }, [activeSlot, releaseVideoElement]);

  // Handle Slot B ready to display
  const handleSlotBReady = useCallback(() => {
    setIsSlotBLoaded(true);
    if (activeSlot === "A") {
      activeSrcRef.current = stagedSrcRef.current;
      setActiveSlot("B");
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        releaseVideoElement(videoRefA.current);
        setSlotA(null);
        setIsSlotALoaded(false);
      }, 600);
    }
  }, [activeSlot, releaseVideoElement]);

  // Tab visibility management: pause video when tab is in background to save GPU & power
  useEffect(() => {
    const handleVisibilityChange = () => {
      const activeVideo = activeSlot === "A" ? videoRefA.current : videoRefB.current;
      if (!activeVideo) return;

      if (document.hidden) {
        try {
          activeVideo.pause();
        } catch {}
      } else {
        try {
          activeVideo.muted = true;
          activeVideo.play().catch(() => {});
        } catch {}
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeSlot]);

  // Component unmount cleanup
  useEffect(() => {
    const videoA = videoRefA.current;
    const videoB = videoRefB.current;
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      releaseVideoElement(videoA);
      releaseVideoElement(videoB);
    };
  }, [releaseVideoElement]);

  const activeVideoLoaded = activeSlot === "A" ? isSlotALoaded : isSlotBLoaded;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#07070c] transform-gpu">
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

      {/* 3. Custom Image / GIF Backgrounds (URL or Upload) */}
      {!isVideoMedia && (bg.kind === "url" || bg.kind === "upload") && (
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: backgroundCss(resolvedValue),
          }}
        />
      )}

      {/* 4. Looping Video Background with Guaranteed Single Active Decoder & Zero Flash */}
      {isVideoMedia && (
        <div className="absolute inset-0 overflow-hidden">
          {/* Subtle atmospheric base to prevent raw white or black flashes */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0c14] via-[#07070c] to-[#040407]" />

          {/* Instant native fallback poster image while video decoder initializes */}
          {effectivePoster && !activeVideoLoaded && (
            <div className="absolute inset-0 z-0 transition-opacity duration-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={effectivePoster}
                alt="Background Poster"
                decoding="async"
                className="size-full object-cover opacity-60"
              />
            </div>
          )}

          {/* Slot A Video */}
          {slotA && (
            <video
              ref={videoRefA}
              src={slotA.src}
              poster={slotA.poster}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
              onCanPlay={handleSlotAReady}
              onPlaying={handleSlotAReady}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out ${
                activeSlot === "A" && isSlotALoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* Slot B Video */}
          {slotB && (
            <video
              ref={videoRefB}
              src={slotB.src}
              poster={slotB.poster}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
              onCanPlay={handleSlotBReady}
              onPlaying={handleSlotBReady}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out ${
                activeSlot === "B" && isSlotBLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </div>
      )}

      {/* 5. Minimal edge vignette for UI readability without expensive blur */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35 pointer-events-none" />
    </div>
  );
}

// Strictly memoize RoomBackground to prevent re-renders when parent states (like player progress) update
export const RoomBackground = memo(
  RoomBackgroundComponent,
  (prev, next) =>
    prev.background?.kind === next.background?.kind &&
    prev.background?.value === next.background?.value &&
    prev.background?.name === next.background?.name &&
    prev.background?.posterUrl === next.background?.posterUrl &&
    prev.user?.background?.kind === next.user?.background?.kind &&
    prev.user?.background?.value === next.user?.background?.value &&
    prev.user?.background?.name === next.user?.background?.name
);

