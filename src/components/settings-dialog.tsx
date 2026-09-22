"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import {
  ROOM_PRESETS,
  DEFAULT_LIVE_SHADERS,
  LiveShader,
} from "@/lib/backgrounds";
import type { Background, BackgroundMetadata } from "@/lib/types";
import { cn } from "@/lib/utils";

type RoomTab = "live" | "liquid";

// Helper to generate a deterministic, visually rich dark gradient when a video poster is missing
function getDeterministicPosterGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 50) % 360;
  return `radial-gradient(ellipse at 50% 30%, hsl(${hue1}, 60%, 14%) 0%, hsl(${hue2}, 70%, 5%) 100%)`;
}

// Lightweight memoized card without individual video decoders
const LiveShaderCard = memo(function LiveShaderCard({
  shader,
  isSelected,
  onHoverStart,
  onHoverEnd,
  onSelect,
  onConfirm,
}: {
  shader: LiveShader;
  isSelected: boolean;
  onHoverStart: (shader: LiveShader, el: HTMLElement) => void;
  onHoverEnd: () => void;
  onSelect: () => void;
  onConfirm?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [posterError, setPosterError] = useState(false);

  // Instant static poster matching for known shaders to bypass API overhead completely
  const effectivePoster =
    shader.posterUrl ||
    (() => {
      const lower = shader.url.toLowerCase();
      if (lower.includes("hololive") || lower.includes("okayu")) return "/thumbnails/hololive.jpg";
      if (lower.includes("pool")) return "/thumbnails/pool.jpg";
      if (lower.includes("miku")) return "/thumbnails/hatsune-miku.jpg";
      if (lower.includes("batman") || lower.includes("vengeance")) return "/thumbnails/batman.jpg";
      if (lower.includes("videoplayback__1_") || lower.includes("videoplayback%20(1)")) return "/thumbnails/videoplayback-1.jpg";
      if (lower.includes("videoplayback")) return "/thumbnails/videoplayback.jpg";
      return "";
    })();

  // 140ms hover intent debounce prevents triggering video decoders on cursor sweeps
  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (containerRef.current) {
        onHoverStart(shader, containerRef.current);
      }
    }, 140);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    onHoverEnd();
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (isSelected && onConfirm) {
      e.stopPropagation();
      onConfirm();
    } else {
      onSelect();
    }
  };

  const fallbackGradient = getDeterministicPosterGradient(shader.name || shader.id);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative flex flex-col cursor-pointer transition-all duration-200 rounded-xl overflow-hidden border select-none transform-gpu",
        isSelected
          ? "border-white ring-2 ring-white/60 shadow-lg shadow-black/80"
          : "border-white/10 hover:border-white/40 bg-zinc-950/80 hover:bg-zinc-900/60"
      )}
    >
      <div
        className="relative aspect-video w-full overflow-hidden bg-black flex items-center justify-center"
        style={{
          background: effectivePoster && !posterError ? undefined : fallbackGradient,
        }}
      >
        {/* Instant Poster Thumbnail (Always visible immediately) */}
        {effectivePoster && !posterError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={effectivePoster}
            alt={shader.name}
            loading="lazy"
            decoding="async"
            onError={() => setPosterError(true)}
            className="absolute inset-0 size-full object-cover opacity-95 transition-opacity duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none">
            <div className="size-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center backdrop-blur-sm shadow-inner">
              <Video className="size-3.5 text-white/40 group-hover:text-white/80 transition-colors" />
            </div>
          </div>
        )}

        {/* Bottom shadow gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

        {/* Interactive Selected Badge & Tick Control */}
        {isSelected && (
          <button
            type="button"
            aria-label="Selected - tap to apply and close"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm?.();
            }}
            className="absolute top-2 right-2 rounded-full bg-white p-1 text-black shadow-md z-10 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
          >
            <Check className="size-3 stroke-[3]" />
          </button>
        )}

        {/* Title bar */}
        <div className="absolute bottom-1.5 inset-x-2.5 flex items-center pointer-events-none">
          <span className="text-[11px] font-medium text-white truncate drop-shadow-md">
            {shader.name}
          </span>
        </div>
      </div>
    </div>
  );
});

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<RoomTab>("live");
  const [dynamicShaders, setDynamicShaders] = useState<LiveShader[]>(DEFAULT_LIVE_SHADERS);

  // Single shared preview video player state & refs
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const sharedVideoRef = useRef<HTMLVideoElement | null>(null);
  const leaveGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activePreview, setActivePreview] = useState<{
    shaderId: string;
    url: string;
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // When card is hovered, point the single shared preview video to it
  const handleCardHoverStart = useCallback((shader: LiveShader, el: HTMLElement) => {
    if (leaveGraceTimerRef.current) {
      clearTimeout(leaveGraceTimerRef.current);
      leaveGraceTimerRef.current = null;
    }

    const grid = gridContainerRef.current;
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const top = elRect.top - gridRect.top + grid.scrollTop;
    const left = elRect.left - gridRect.left + grid.scrollLeft;
    const width = elRect.width;
    const height = elRect.height;

    setActivePreview((prev) => {
      const isSameUrl = prev?.url === shader.url;
      if (!isSameUrl) {
        setIsPreviewPlaying(false);
        const video = sharedVideoRef.current;
        if (video) {
          video.src = shader.url;
          video.currentTime = 0;
          const p = video.play();
          if (p !== undefined) {
            p.then(() => setIsPreviewPlaying(true)).catch(() => {});
          }
        }
      } else {
        const video = sharedVideoRef.current;
        if (video && video.paused) {
          video.play().catch(() => {});
        }
      }
      return {
        shaderId: shader.id,
        url: shader.url,
        top,
        left,
        width,
        height,
      };
    });
  }, []);

  // When hover ends, release the single preview video
  const handleCardHoverEnd = useCallback(() => {
    if (leaveGraceTimerRef.current) clearTimeout(leaveGraceTimerRef.current);
    leaveGraceTimerRef.current = setTimeout(() => {
      setActivePreview(null);
      setIsPreviewPlaying(false);
      const video = sharedVideoRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch {}
      }
    }, 100);
  }, []);

  // Cleanup preview video when tab changes or dialog closes
  useEffect(() => {
    if (!open || activeTab !== "live") {
      if (leaveGraceTimerRef.current) clearTimeout(leaveGraceTimerRef.current);
      setActivePreview(null);
      setIsPreviewPlaying(false);
      const video = sharedVideoRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch {}
      }
    }
  }, [open, activeTab]);

  // Fetch all live shaders from admin/Supabase
  useEffect(() => {
    let active = true;
    async function loadAllShaders() {
      try {
        const res = await fetch("/api/backgrounds");
        if (res.ok) {
          const data = await res.json();
          if (data.backgrounds && Array.isArray(data.backgrounds) && active) {
            const mapped: LiveShader[] = data.backgrounds.map((bg: BackgroundMetadata) => ({
              id: bg.id,
              name: bg.name,
              url: bg.videoUrl,
              posterUrl: bg.posterUrl || "",
              ambientHue: "#4338ca",
              darkAccent: "#1e1b4b",
              lightAccent: "#818cf8",
            }));
            setDynamicShaders(mapped);
          }
        }
      } catch {
        // Handled
      }
    }

    if (open) {
      loadAllShaders();
    }

    return () => {
      active = false;
    };
  }, [open]);

  if (!user) return null;

  function setBackground(background: Background) {
    updateUser({ background });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass-window !border-white/20 !bg-[#0a0a10]/80 !text-white backdrop-blur-2xl max-w-[calc(100%-1.5rem)] sm:max-w-[560px] max-h-[90dvh] flex flex-col rounded-2xl shadow-2xl p-4 sm:p-6 overflow-hidden"
      >
        {/* Header with Title, Description, and Close 'X' Button */}
        <div className="relative">
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
              Room Atmosphere
            </DialogTitle>
            <DialogDescription className="text-white/60 text-[13px] font-normal leading-normal">
              Select an atmospheric live shader or procedural fluid canvas backdrop.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tab Navigation (Live Shaders & Liquid Shaders) */}
        <div className="mt-3.5 flex border-b border-white/10 gap-1 pb-1 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === "live"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Video className="size-3.5" />
            Live Shaders
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("liquid")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === "liquid"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Sparkles className="size-3.5" />
            Liquid Shaders
          </button>
        </div>

        {/* Tab 1: Live Shaders */}
        {activeTab === "live" && (
          <div className="mt-3.5 space-y-2 flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Atmospheric Video Shaders
              </span>
              <span className="text-[11px] text-white/40">
                Hover to preview • Tap to apply
              </span>
            </div>

            {dynamicShaders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                <Video className="size-8 text-white/25 mb-2.5" />
                <p className="text-sm font-medium text-white/70">No Live Shaders Available</p>
                <p className="text-xs text-white/40 mt-1 max-w-xs">
                  Upload and publish live shaders from the Admin panel to see them here.
                </p>
              </div>
            ) : (
              <div
                ref={gridContainerRef}
                onScroll={() => {
                  if (activePreview) {
                    setActivePreview(null);
                    setIsPreviewPlaying(false);
                    const video = sharedVideoRef.current;
                    if (video) {
                      try {
                        video.pause();
                      } catch {}
                    }
                  }
                }}
                className="relative grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 max-h-[340px] overflow-y-auto pr-1 slim-transparent-scrollbar"
              >
                {/* The Single Reusable Video Preview Element */}
                <video
                  ref={sharedVideoRef}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  onCanPlay={() => setIsPreviewPlaying(true)}
                  onPlaying={() => setIsPreviewPlaying(true)}
                  className={cn(
                    "absolute pointer-events-none rounded-xl object-cover transition-opacity duration-200 z-10",
                    activePreview && isPreviewPlaying ? "opacity-100" : "opacity-0"
                  )}
                  style={{
                    display: activePreview ? "block" : "none",
                    top: activePreview?.top ?? 0,
                    left: activePreview?.left ?? 0,
                    width: activePreview?.width ?? 0,
                    height: activePreview?.height ?? 0,
                  }}
                />

                {dynamicShaders.map((shader) => {
                  const isSelected =
                    user.background.kind === "video" &&
                    (user.background.value === shader.url ||
                      user.background.value === shader.id ||
                      user.background.name === shader.name);
                  return (
                    <LiveShaderCard
                      key={shader.id}
                      shader={shader}
                      isSelected={isSelected}
                      onHoverStart={handleCardHoverStart}
                      onHoverEnd={handleCardHoverEnd}
                      onSelect={() =>
                        setBackground({
                          kind: "video",
                          value: shader.url,
                          name: shader.name,
                          posterUrl: shader.posterUrl,
                        })
                      }
                      onConfirm={() => onOpenChange(false)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Liquid Shaders */}
        {activeTab === "liquid" && (
          <div className="mt-3.5 space-y-2 flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                GPU Procedural Fluid Shaders
              </span>
              <span className="text-[11px] text-white/40">
                Interactive real-time canvas
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {ROOM_PRESETS.map((preset) => {
                const isSelected =
                  user.background.kind === "preset" &&
                  (user.background.value === preset.id || user.background.value === preset.value);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setBackground({
                        kind: "preset",
                        value: preset.id,
                      });
                      if (isSelected) {
                        onOpenChange(false);
                      }
                    }}
                    className={cn(
                      "group relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      isSelected
                        ? "border-white bg-white text-black ring-2 ring-white/50 shadow-md"
                        : "border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white"
                    )}
                  >
                    <div
                      className="size-9 rounded-lg shadow-inner mb-1.5 transition-transform group-hover:scale-105 border border-black/20"
                      style={{ background: preset.preview }}
                    />
                    <span
                      className={cn(
                        "text-[11px] font-semibold truncate w-full",
                        isSelected ? "text-black" : "text-white/90"
                      )}
                    >
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
