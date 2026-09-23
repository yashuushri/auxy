"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Disc,
  X,
  GripVertical,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/context/player-context";
import { DockWidget } from "@/components/dock-widget";

export type WidgetType = "clock" | "calendar" | "vinyl" | "notes" | "dock";

export interface ActiveWidgetsState {
  clock: boolean;
  calendar: boolean;
  vinyl: boolean;
  notes: boolean;
  dock: boolean;
}



// ==========================================
// 1. TRANSPARENT AESTHETIC CLOCK WIDGET (4 AESTHETIC THEMES & HOVER OPTIONS)
// ==========================================
type ClockTheme = "minimal" | "flip" | "glass-date" | "analog-circle";
type ClockLayout = "inline" | "stacked";
type ClockSize = "sm" | "md" | "lg";

function ClockWidget({ onClose }: { onClose: () => void }) {
  const storageKey = "auxy_widget_pos_clock";
  const [pos, setPos] = useState({ x: 32, y: 72 });
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const currentPosRef = useRef({ x: 32, y: 72 });

  const [time, setTime] = useState<Date | null>(null);
  const [theme, setTheme] = useState<ClockTheme>(() => {
    if (typeof window !== "undefined") {
      try {
        const val = localStorage.getItem("auxy_clock_theme");
        if (val === "minimal" || val === "flip" || val === "glass-date" || val === "analog-circle") return val;
      } catch {}
    }
    return "minimal";
  });
  const [is24Hour, setIs24Hour] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("auxy_clock_24h") === "true";
      } catch {}
    }
    return false;
  });
  const [layout, setLayout] = useState<ClockLayout>(() => {
    if (typeof window !== "undefined") {
      try {
        const val = localStorage.getItem("auxy_clock_layout");
        if (val === "stacked" || val === "inline") return val;
      } catch {}
    }
    return "inline";
  });
  const [size, setSize] = useState<ClockSize>(() => {
    if (typeof window !== "undefined") {
      try {
        const val = localStorage.getItem("auxy_clock_size");
        if (val === "sm" || val === "md" || val === "lg") return val;
      } catch {}
    }
    return "md";
  });

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(16, window.innerWidth - 320);
          const maxY = Math.max(60, window.innerHeight - 140);
          const loaded = {
            x: Math.min(Math.max(16, parsed.x), maxX),
            y: Math.min(Math.max(60, parsed.y), maxY),
          };
          setPos(loaded);
          currentPosRef.current = loaded;
        }
      }
    } catch {}
  }, []);

  // Update clock every second
  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Close menu when clicking elsewhere
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = () => setMenuOpen(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  // Buttery-Smooth Direct DOM Dragging Engine (zero frame drops via RAF)
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: currentPosRef.current.x,
      originY: currentPosRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(8, Math.min(window.innerWidth - 180, dragRef.current.originX + dx));
    const newY = Math.max(48, Math.min(window.innerHeight - 80, dragRef.current.originY + dy));
    currentPosRef.current = { x: newX, y: newY };

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      if (elementRef.current) {
        elementRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
      setPos({ ...currentPosRef.current });
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentPosRef.current));
      } catch {}
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  if (!time) return null;

  const hours = time.getHours();
  const rawMinutes = time.getMinutes();
  const rawSeconds = time.getSeconds();
  const minutes = rawMinutes.toString().padStart(2, "0");
  const isPm = hours >= 12;
  const displayHours = is24Hour
    ? hours.toString().padStart(2, "0")
    : (hours % 12 || 12).toString().padStart(2, "0");

  // Date strings for Glass-Date theme
  const dayName = time.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const monthDay = time.toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase();
  const fullDateString = `${dayName}, ${monthDay}`;

  // Analog watch angles
  const hourAngle = ((hours % 12) + rawMinutes / 60 + rawSeconds / 3600) * 30;
  const minuteAngle = (rawMinutes + rawSeconds / 60) * 6;
  const secondAngle = rawSeconds * 6;
  const shortDay = time.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dayNumber = time.getDate();

  const digitSizeClasses =
    size === "sm"
      ? "text-3xl sm:text-4xl"
      : size === "lg"
      ? "text-6xl sm:text-7xl"
      : "text-4.5xl sm:text-5.5xl";

  return (
    <div
      ref={elementRef}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        willChange: "transform",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "group fixed top-0 left-0 select-none p-3 rounded-2xl bg-transparent transition-all duration-150 cursor-grab active:cursor-grabbing",
        "hover:bg-white/[0.04] hover:ring-1 hover:ring-white/10 hover:backdrop-blur-[2px]",
        dragging
          ? "z-[70] ring-1 ring-white/30 bg-black/25 backdrop-blur-sm scale-[1.02] shadow-2xl"
          : "z-[15]"
      )}
    >
      {/* Floating Minimal Hover Controls (Direct Drag, 3-Dot Options & Direct Close) */}
      <div
        className={cn(
          "absolute -top-3 -right-2 flex items-center gap-1 z-30 transition-all duration-150",
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
          dragging && "opacity-100 pointer-events-auto"
        )}
      >
        {/* Drag Handle Icon */}
        <div
          title="Drag Clock"
          className="p-1 rounded-full bg-black/80 hover:bg-black text-white/50 hover:text-white border border-white/15 backdrop-blur-md cursor-grab active:cursor-grabbing shadow-lg transition-colors"
        >
          <GripVertical className="size-3" />
        </div>

        {/* 3-Dot Settings Menu Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          title="Clock Settings (Themes, Layout, Format, Size)"
          className={cn(
            "p-1 rounded-full border backdrop-blur-md transition-all cursor-pointer shadow-lg",
            menuOpen
              ? "bg-white text-black border-white"
              : "bg-black/80 hover:bg-black text-white/60 hover:text-white border-white/15"
          )}
        >
          <MoreVertical className="size-3" />
        </button>

        {/* Direct Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close Clock"
          className="p-1 rounded-full bg-black/80 hover:bg-red-500 text-white/60 hover:text-white border border-white/15 backdrop-blur-md transition-colors cursor-pointer shadow-lg"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* 3-Dot Dropdown Settings Popover */}
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-2 right-10 z-40 w-52 rounded-2xl bg-[#0d0d14]/95 border border-white/15 p-2.5 text-white shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 select-none cursor-default"
        >
          {/* Theme Selector */}
          <div className="mb-2.5">
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1.5">
              Clock Theme
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: "minimal", label: "Minimal HUD" },
                { id: "flip", label: "Flip (Mac)" },
                { id: "glass-date", label: "Glass Date" },
                { id: "analog-circle", label: "Apple Dial" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id as ClockTheme);
                    try {
                      localStorage.setItem("auxy_clock_theme", t.id);
                    } catch {}
                  }}
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer text-center",
                    theme === t.id
                      ? "bg-white text-black font-bold shadow"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layout Toggle (Only for digital themes) */}
          {theme !== "analog-circle" && theme !== "glass-date" && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1">
                Layout
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setLayout("inline");
                    try {
                      localStorage.setItem("auxy_clock_layout", "inline");
                    } catch {}
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center",
                    layout === "inline"
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  Inline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayout("stacked");
                    try {
                      localStorage.setItem("auxy_clock_layout", "stacked");
                    } catch {}
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center",
                    layout === "stacked"
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  Stacked
                </button>
              </div>
            </div>
          )}

          {/* Format Toggle (12h / 24h) */}
          {theme !== "analog-circle" && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1">
                Format
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIs24Hour(false);
                    try {
                      localStorage.setItem("auxy_clock_24h", "false");
                    } catch {}
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center",
                    !is24Hour
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  12-Hour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIs24Hour(true);
                    try {
                      localStorage.setItem("auxy_clock_24h", "true");
                    } catch {}
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center",
                    is24Hour
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  24-Hour
                </button>
              </div>
            </div>
          )}

          {/* Size Options */}
          <div>
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1">
              Size
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["sm", "md", "lg"] as ClockSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSize(s);
                    try {
                      localStorage.setItem("auxy_clock_size", s);
                    } catch {}
                  }}
                  className={cn(
                    "px-1.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer text-center",
                    size === s
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* THEME 1: MINIMAL TRANSPARENT HUD */}
      {/* ============================================================ */}
      {theme === "minimal" && (
        <>
          {layout === "inline" ? (
            <div className="flex items-baseline justify-center font-mono font-black tracking-tighter text-white select-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
              <span className={cn(digitSizeClasses, "tracking-tight text-white")}>
                {displayHours}
              </span>
              <span className={cn(digitSizeClasses, "text-white mx-1 font-bold")}>
                :
              </span>
              <span className={cn(digitSizeClasses, "tracking-tight text-white")}>
                {minutes}
              </span>

              {!is24Hour && (
                <span className="ml-2 text-[11px] sm:text-[13px] font-sans font-extrabold uppercase tracking-widest text-white/70">
                  {isPm ? "PM" : "AM"}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center font-mono font-black tracking-tighter text-white select-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] leading-none gap-0.5">
              <div className={cn(digitSizeClasses, "text-white")}>{displayHours}</div>
              <div className={cn(digitSizeClasses, "text-white")}>{minutes}</div>
              {!is24Hour && (
                <div className="mt-1 text-[11px] sm:text-[12px] font-sans font-extrabold uppercase tracking-widest text-white/70">
                  {isPm ? "PM" : "AM"}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* THEME 2: FLIP CLOCK (MAC / FLIQLO SCREENSAVER) */}
      {/* ============================================================ */}
      {theme === "flip" && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 select-none",
            layout === "stacked" ? "flex-col gap-2" : "flex-row"
          )}
        >
          {/* Hours Flip Tile */}
          <div
            className={cn(
              "relative rounded-xl bg-[#121218]/90 border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden font-sans font-black text-white",
              size === "sm" ? "w-16 h-20 text-3xl" : size === "lg" ? "w-28 h-32 text-6xl" : "w-20 h-24 text-4xl"
            )}
          >
            {/* Split Flap Crease & Hinges */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 z-10 shadow-[0_1px_0_rgba(255,255,255,0.08)]" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-neutral-900 border border-white/20 rounded-r z-20" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-neutral-900 border border-white/20 rounded-l z-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent h-1/2 pointer-events-none" />

            {/* AM / PM Badge on Hour Flap */}
            {!is24Hour && (
              <span className="absolute top-1.5 left-2 text-[8px] sm:text-[9px] font-mono font-bold tracking-wider text-white/40 uppercase z-20">
                {isPm ? "PM" : "AM"}
              </span>
            )}

            <span className="tracking-tighter drop-shadow-md">{displayHours}</span>
          </div>

          {/* Minutes Flip Tile */}
          <div
            className={cn(
              "relative rounded-xl bg-[#121218]/90 border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden font-sans font-black text-white",
              size === "sm" ? "w-16 h-20 text-3xl" : size === "lg" ? "w-28 h-32 text-6xl" : "w-20 h-24 text-4xl"
            )}
          >
            {/* Split Flap Crease & Hinges */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 z-10 shadow-[0_1px_0_rgba(255,255,255,0.08)]" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-neutral-900 border border-white/20 rounded-r z-20" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-neutral-900 border border-white/20 rounded-l z-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent h-1/2 pointer-events-none" />

            <span className="tracking-tighter drop-shadow-md">{minutes}</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* THEME 3: GLASS DAY & DATE + BIG FROSTED GLASS TIME */}
      {/* (Top: Day & Date, Bottom: Big Glass Digits, No Seconds, No AM/PM) */}
      {/* ============================================================ */}
      {theme === "glass-date" && (
        <div className="flex flex-col items-center justify-center text-center select-none py-1 px-2">
          {/* Top Line: Day and Full Date in Glassy Typography */}
          <div className="text-[11px] sm:text-xs font-sans font-bold tracking-[0.2em] text-white/70 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] mb-0.5">
            {fullDateString}
          </div>

          {/* Bottom Big Frosted Glass Time (No Seconds, No AM/PM) */}
          <div className="flex items-baseline justify-center font-mono font-black tracking-tighter leading-none select-none">
            <span
              className={cn(
                size === "sm" ? "text-4xl sm:text-5xl" : size === "lg" ? "text-7xl sm:text-8xl" : "text-5.5xl sm:text-6.5xl",
                "bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)]"
              )}
            >
              {displayHours}
            </span>
            <span
              className={cn(
                size === "sm" ? "text-4xl sm:text-5xl" : size === "lg" ? "text-7xl sm:text-8xl" : "text-5.5xl sm:text-6.5xl",
                "mx-1.5 font-light text-white/70 drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)]"
              )}
            >
              :
            </span>
            <span
              className={cn(
                size === "sm" ? "text-4xl sm:text-5xl" : size === "lg" ? "text-7xl sm:text-8xl" : "text-5.5xl sm:text-6.5xl",
                "bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)]"
              )}
            >
              {minutes}
            </span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* THEME 4: APPLE WATCH FACE / CIRCULAR MINIMAL ANALOG DIAL */}
      {/* ============================================================ */}
      {theme === "analog-circle" && (
        <div className="flex items-center justify-center select-none">
          <div
            className={cn(
              "relative rounded-full border border-white/20 bg-white/[0.04] backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.2)] flex items-center justify-center",
              size === "sm" ? "size-36" : size === "lg" ? "size-56" : "size-44"
            )}
          >
            {/* Hour Markers (12, 3, 6, 9 Cardinal and 12-Hour Ticks) */}
            <div className="absolute inset-2 rounded-full pointer-events-none">
              {[...Array(12)].map((_, i) => {
                const angle = i * 30;
                const isCardinal = i % 3 === 0;
                return (
                  <div
                    key={i}
                    className="absolute inset-0 flex items-start justify-center pointer-events-none"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <div
                      className={cn(
                        "rounded-full",
                        isCardinal ? "w-1 h-3 bg-white shadow-sm" : "w-0.5 h-1.5 bg-white/40"
                      )}
                    />
                  </div>
                );
              })}
            </div>

            {/* Date Complication Pill (e.g. WED 23) */}
            <div className="absolute right-4.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[8px] sm:text-[9px] font-mono font-bold text-white/90 tracking-tight shadow-sm z-10">
              {shortDay} {dayNumber}
            </div>

            {/* Analog Clock Hands */}
            <div className="relative size-full pointer-events-none flex items-center justify-center">
              {/* Hour Hand */}
              <div
                className="absolute w-1.5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.8)] origin-bottom z-20"
                style={{
                  height: size === "sm" ? "28px" : size === "lg" ? "48px" : "36px",
                  bottom: "50%",
                  transform: `rotate(${hourAngle}deg)`,
                  transformOrigin: "bottom center",
                }}
              />

              {/* Minute Hand */}
              <div
                className="absolute w-1 rounded-full bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.8)] origin-bottom z-20"
                style={{
                  height: size === "sm" ? "38px" : size === "lg" ? "64px" : "50px",
                  bottom: "50%",
                  transform: `rotate(${minuteAngle}deg)`,
                  transformOrigin: "bottom center",
                }}
              />

              {/* Orange/Red Sweep Second Hand */}
              <div
                className="absolute w-0.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.6)] origin-bottom z-30"
                style={{
                  height: size === "sm" ? "44px" : size === "lg" ? "74px" : "56px",
                  bottom: "50%",
                  transform: `rotate(${secondAngle}deg)`,
                  transformOrigin: "bottom center",
                }}
              />

              {/* Center Pivot Pin */}
              <div className="relative z-40 size-3 rounded-full bg-neutral-900 border-2 border-amber-400 shadow-md flex items-center justify-center">
                <div className="size-1 rounded-full bg-white" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 1B. AESTHETIC GLASS CALENDAR WIDGET (DRAGGABLE & FROSTED GLASS)
// ==========================================
function CalendarWidget({ onClose }: { onClose: () => void }) {
  const storageKey = "auxy_widget_pos_calendar";
  // Default position: Right underneath the clock widget
  const [pos, setPos] = useState({ x: 32, y: 175 });
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const currentPosRef = useRef({ x: 32, y: 175 });

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [startOnMonday, setStartOnMonday] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("auxy_calendar_mon_start") === "true";
      } catch {}
    }
    return false;
  });

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(16, window.innerWidth - 300);
          const maxY = Math.max(60, window.innerHeight - 300);
          const loaded = {
            x: Math.min(Math.max(16, parsed.x), maxX),
            y: Math.min(Math.max(60, parsed.y), maxY),
          };
          setPos(loaded);
          currentPosRef.current = loaded;
        }
      }
    } catch {}
  }, []);

  // Sync today's date periodically
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = () => setMenuOpen(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  // Buttery-Smooth Direct DOM Dragging Engine
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: currentPosRef.current.x,
      originY: currentPosRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(8, Math.min(window.innerWidth - 260, dragRef.current.originX + dx));
    const newY = Math.max(48, Math.min(window.innerHeight - 260, dragRef.current.originY + dy));
    currentPosRef.current = { x: newX, y: newY };

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      if (elementRef.current) {
        elementRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
      setPos({ ...currentPosRef.current });
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentPosRef.current));
      } catch {}
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Calendar calculations
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" }).toUpperCase();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const adjustedFirstDay = startOnMonday ? (firstDayIndex === 0 ? 6 : firstDayIndex - 1) : firstDayIndex;
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const weekLabels = startOnMonday
    ? ["M", "T", "W", "T", "F", "S", "S"]
    : ["S", "M", "T", "W", "T", "F", "S"];

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const isToday = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return false;
    return (
      day === currentDate.getDate() &&
      month === currentDate.getMonth() &&
      year === currentDate.getFullYear()
    );
  };

  // Generate 35 or 42 grid cells
  const daysGrid: Array<{ day: number; isCurrentMonth: boolean; key: string }> = [];

  // Prev month padding
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    daysGrid.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      key: `prev-${i}`,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push({
      day: d,
      isCurrentMonth: true,
      key: `curr-${d}`,
    });
  }

  // Next month padding (up to multiples of 7)
  const remainingCells = (7 - (daysGrid.length % 7)) % 7;
  for (let n = 1; n <= remainingCells; n++) {
    daysGrid.push({
      day: n,
      isCurrentMonth: false,
      key: `next-${n}`,
    });
  }

  return (
    <div
      ref={elementRef}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        willChange: "transform",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "group fixed top-0 left-0 select-none p-3.5 rounded-3xl bg-[#0e0e16]/60 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-all duration-150 cursor-grab active:cursor-grabbing w-[240px]",
        "hover:bg-[#0e0e16]/75 hover:border-white/25",
        dragging
          ? "z-[70] ring-1 ring-white/30 bg-[#0e0e16]/90 shadow-2xl scale-[1.02]"
          : "z-[15]"
      )}
    >
      {/* Floating Minimal Hover Controls (Drag Handle, 3-Dot, Close) */}
      <div
        className={cn(
          "absolute -top-3 -right-2 flex items-center gap-1 z-30 transition-all duration-150",
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
          dragging && "opacity-100 pointer-events-auto"
        )}
      >
        {/* Drag Handle Icon */}
        <div
          title="Drag Calendar"
          className="p-1 rounded-full bg-black/80 hover:bg-black text-white/50 hover:text-white border border-white/15 backdrop-blur-md cursor-grab active:cursor-grabbing shadow-lg transition-colors"
        >
          <GripVertical className="size-3" />
        </div>

        {/* 3-Dot Settings Menu Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          title="Calendar Settings"
          className={cn(
            "p-1 rounded-full border backdrop-blur-md transition-all cursor-pointer shadow-lg",
            menuOpen
              ? "bg-white text-black border-white"
              : "bg-black/80 hover:bg-black text-white/60 hover:text-white border-white/15"
          )}
        >
          <MoreVertical className="size-3" />
        </button>

        {/* Direct Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close Calendar"
          className="p-1 rounded-full bg-black/80 hover:bg-red-500 text-white/60 hover:text-white border border-white/15 backdrop-blur-md transition-colors cursor-pointer shadow-lg"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* 3-Dot Settings Popover */}
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-2 right-10 z-40 w-44 rounded-2xl bg-[#0d0d14]/95 border border-white/15 p-2.5 text-white shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 select-none cursor-default"
        >
          <div className="mb-2">
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1">
              Week Start
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  setStartOnMonday(false);
                  try {
                    localStorage.setItem("auxy_calendar_mon_start", "false");
                  } catch {}
                }}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center",
                  !startOnMonday
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                Sunday
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartOnMonday(true);
                  try {
                    localStorage.setItem("auxy_calendar_mon_start", "true");
                  } catch {}
                }}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center",
                  startOnMonday
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                Monday
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Header: Month, Year & Month Navigation */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans font-extrabold text-[13px] tracking-wider text-white uppercase drop-shadow-sm">
            {monthName}
          </span>
          <span className="font-mono text-[11px] font-bold text-white/40">
            {year}
          </span>
        </div>

        {/* Minimal Navigation Buttons */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevMonth();
            }}
            title="Previous Month"
            className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextMonth();
            }}
            title="Next Month"
            className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday Label Row */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1 font-mono text-[9px] font-extrabold text-white/35 uppercase tracking-wider">
        {weekLabels.map((lbl, idx) => (
          <div key={idx} className="py-0.5">
            {lbl}
          </div>
        ))}
      </div>

      {/* Days Month Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {daysGrid.map((item) => {
          const currentDayMatch = isToday(item.day, item.isCurrentMonth);
          return (
            <div
              key={item.key}
              className={cn(
                "h-6.5 w-6.5 mx-auto rounded-full flex items-center justify-center font-mono text-[11px] transition-all",
                currentDayMatch
                  ? "bg-white text-black font-bold shadow-sm"
                  : item.isCurrentMonth
                  ? "text-white/80 hover:text-white hover:bg-white/10 font-medium cursor-pointer"
                  : "text-white/20 font-normal"
              )}
            >
              {item.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 2. REALISTIC TRANSPARENT VINYL TURNTABLE WIDGET (SYNCED WITH PLAYER)
// ==========================================
function VinylWidget({ onClose }: { onClose: () => void }) {
  const { isPlaying, currentTrack } = usePlayer();
  const storageKey = "auxy_widget_pos_vinyl";
  const [pos, setPos] = useState({ x: 32, y: 160 });
  const [dragging, setDragging] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const currentPosRef = useRef({ x: 32, y: 160 });

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(16, window.innerWidth - 260);
          const maxY = Math.max(60, window.innerHeight - 260);
          const loaded = {
            x: Math.min(Math.max(16, parsed.x), maxX),
            y: Math.min(Math.max(60, parsed.y), maxY),
          };
          setPos(loaded);
          currentPosRef.current = loaded;
        }
      }
    } catch {}
  }, []);

  // Buttery-smooth Direct DOM Dragging Engine
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: currentPosRef.current.x,
      originY: currentPosRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(8, Math.min(window.innerWidth - 240, dragRef.current.originX + dx));
    const newY = Math.max(48, Math.min(window.innerHeight - 240, dragRef.current.originY + dy));
    currentPosRef.current = { x: newX, y: newY };

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      if (elementRef.current) {
        elementRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
      setPos({ ...currentPosRef.current });
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentPosRef.current));
      } catch {}
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  return (
    <div
      ref={elementRef}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        willChange: "transform",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "group fixed top-0 left-0 select-none p-3 rounded-3xl bg-transparent transition-all duration-150 cursor-grab active:cursor-grabbing",
        "hover:bg-white/[0.04] hover:ring-1 hover:ring-white/10 hover:backdrop-blur-[2px]",
        dragging
          ? "z-[70] ring-1 ring-white/30 bg-black/30 backdrop-blur-sm scale-[1.02] shadow-2xl"
          : "z-[15]"
      )}
    >
      {/* Floating Minimal Controls (Drag Handle & Direct Close Only) */}
      <div
        className={cn(
          "absolute -top-3 -right-1 flex items-center gap-1 z-30 transition-all duration-150",
          "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
          dragging && "opacity-100 pointer-events-auto"
        )}
      >
        {/* Drag Handle */}
        <div
          title="Drag Vinyl"
          className="p-1 rounded-full bg-black/80 hover:bg-black text-white/50 hover:text-white border border-white/15 backdrop-blur-md cursor-grab active:cursor-grabbing shadow-lg transition-colors"
        >
          <GripVertical className="size-3" />
        </div>

        {/* Direct Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close Vinyl"
          className="p-1 rounded-full bg-black/80 hover:bg-red-500 text-white/60 hover:text-white border border-white/15 backdrop-blur-md transition-colors cursor-pointer shadow-lg"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Turntable Assembly (Vinyl Disc + Mechanical Tonearm) */}
      <div className="relative size-48 flex items-center justify-center">
        {/* Realistic Vinyl Disc (Pure Aesthetic Hi-Fi Object) */}
        <div
          className="relative size-44 rounded-full flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_20px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{
            background:
              "conic-gradient(from 45deg, #0d0d12 0deg, #24242c 40deg, #0e0e13 85deg, #282832 135deg, #0b0b0f 180deg, #24242c 225deg, #0d0d12 270deg, #272730 315deg, #0d0d12 360deg)",
            boxShadow: "inset 0 0 10px rgba(255,255,255,0.08), 0 10px 30px rgba(0,0,0,0.85)",
          }}
        >
          {/* Micro Grooves Overlay */}
          <div
            className="absolute inset-1.5 rounded-full pointer-events-none"
            style={{
              backgroundImage:
                "repeating-radial-gradient(circle, transparent 0, transparent 2.5px, rgba(255,255,255,0.035) 3.5px, transparent 4.5px)",
              maskImage: "radial-gradient(circle, transparent 28%, black 30%, black 96%, transparent 98%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 28%, black 30%, black 96%, transparent 98%)",
            }}
          />

          {/* Vinyl Rim Rings */}
          <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute inset-3 rounded-full border border-white/[0.04] pointer-events-none" />
          <div className="absolute inset-6 rounded-full border border-white/[0.03] pointer-events-none" />
          <div className="absolute inset-8 rounded-full border border-white/[0.04] pointer-events-none" />
          <div className="absolute inset-11 rounded-full border border-white/[0.03] pointer-events-none" />

          {/* Rotating Center Label & Album Art */}
          <div
            className={cn(
              "relative size-16 rounded-full overflow-hidden shadow-inner flex items-center justify-center border-2 border-white/20 transition-transform duration-700",
              isPlaying ? "animate-[spin_3.6s_linear_infinite]" : ""
            )}
            style={{
              animationPlayState: isPlaying ? "running" : "paused",
            }}
          >
            {currentTrack?.cover ? (
              <Image
                src={currentTrack.cover}
                alt={currentTrack.title || "Album Art"}
                fill
                sizes="64px"
                className="object-cover pointer-events-none"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="size-full bg-gradient-to-tr from-amber-600 via-rose-600 to-indigo-600 flex flex-col items-center justify-center text-center p-1">
                <Disc className="size-4 text-white/90" />
                <span className="text-[6px] font-mono font-bold uppercase tracking-tighter text-white/80 mt-0.5">
                  AUXY HI-FI
                </span>
              </div>
            )}

            {/* Gloss label highlight */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

            {/* Center Spindle Hole (Silver grommet & brass core) */}
            <div className="relative z-10 size-3.5 rounded-full bg-[#1c1c24] border border-white/40 flex items-center justify-center shadow-inner">
              <div className="size-1.5 rounded-full bg-[#0a0a0f] border border-white/20" />
            </div>
          </div>
        </div>

        {/* Mechanical Tonearm Assembly ("stick side main jo hoti hai") */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]" viewBox="0 0 192 192">
            <defs>
              <linearGradient id="tonearmSilver" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f3f4f6" />
                <stop offset="40%" stopColor="#9ca3af" />
                <stop offset="70%" stopColor="#d1d5db" />
                <stop offset="100%" stopColor="#6b7280" />
              </linearGradient>
              <linearGradient id="tonearmBase" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2d2d38" />
                <stop offset="50%" stopColor="#181820" />
                <stop offset="100%" stopColor="#3d3d4a" />
              </linearGradient>
            </defs>

            {/* Tonearm Rest Post & Base Ring (Static) */}
            <circle cx="164" cy="30" r="14" fill="url(#tonearmBase)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <circle cx="164" cy="30" r="7" fill="url(#tonearmSilver)" stroke="#333" strokeWidth="0.5" />
            <rect x="159" y="64" width="7" height="3" rx="1" fill="#4b5563" />
            <line x1="156" y1="63" x2="167" y2="63" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />

            {/* Dynamic Rotating Arm (Rotates onto vinyl when isPlaying, lifts off when paused) */}
            <g
              style={{
                transformOrigin: "164px 30px",
                transform: isPlaying ? "rotate(23deg)" : "rotate(-4deg)",
                transition: "transform 0.85s cubic-bezier(0.34, 1.4, 0.64, 1)",
              }}
            >
              {/* Rear Counterweight */}
              <rect
                x="158"
                y="14"
                width="12"
                height="10"
                rx="2"
                fill="url(#tonearmSilver)"
                stroke="#4b5563"
                strokeWidth="1"
              />
              <line x1="164" y1="14" x2="164" y2="24" stroke="#374151" strokeWidth="1" />

              {/* Pivot Gimbal Bearing */}
              <circle cx="164" cy="30" r="4.5" fill="#111827" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />

              {/* S-Shaped Brushed Metal Tonearm Shaft */}
              <path
                d="M 164 30 L 162 76 Q 160 112 136 134 L 124 144"
                fill="none"
                stroke="url(#tonearmSilver)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Headshell / Stylus Cartridge (Angled to ride the groove) */}
              <g transform="translate(124, 144) rotate(32)">
                <rect
                  x="-3"
                  y="-1"
                  width="8"
                  height="16"
                  rx="1.5"
                  fill="#1f2937"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="0.8"
                />
                {/* Gold Cartridge Label */}
                <rect x="-1.5" y="2" width="5" height="5" fill="#f59e0b" rx="0.5" />
                {/* Needle Stylus Point */}
                <line x1="1" y1="15" x2="1" y2="18" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. FIGMA-INSPIRED AESTHETIC STICKY NOTE WIDGET
// ==========================================
type StickyColor = "yellow" | "peach" | "mint" | "blue" | "lavender" | "charcoal" | "glass";

interface StickyTheme {
  id: StickyColor;
  label: string;
  bg: string;
  dot: string;
  border: string;
  text: string;
  placeholder: string;
  buttonHover: string;
  headerBorder: string;
}

const STICKY_THEMES: Record<StickyColor, StickyTheme> = {
  yellow: {
    id: "yellow",
    label: "Yellow",
    bg: "bg-[#FEF387]",
    dot: "bg-[#FACC15]",
    border: "border-[#EADB5F]",
    text: "text-[#292524]",
    placeholder: "placeholder-[#78716C]/60",
    buttonHover: "hover:bg-black/10 text-[#44403C]",
    headerBorder: "border-[#EADB5F]/60",
  },
  peach: {
    id: "peach",
    label: "Peach",
    bg: "bg-[#FED7AA]",
    dot: "bg-[#FB923C]",
    border: "border-[#FDBA74]",
    text: "text-[#292524]",
    placeholder: "placeholder-[#78716C]/60",
    buttonHover: "hover:bg-black/10 text-[#44403C]",
    headerBorder: "border-[#FDBA74]/60",
  },
  mint: {
    id: "mint",
    label: "Mint",
    bg: "bg-[#BBF7D0]",
    dot: "bg-[#4ADE80]",
    border: "border-[#86EFAC]",
    text: "text-[#14532D]",
    placeholder: "placeholder-[#166534]/60",
    buttonHover: "hover:bg-black/10 text-[#14532D]",
    headerBorder: "border-[#86EFAC]/60",
  },
  blue: {
    id: "blue",
    label: "Blue",
    bg: "bg-[#BAE6FD]",
    dot: "bg-[#38BDF8]",
    border: "border-[#7DD3FC]",
    text: "text-[#0C4A6E]",
    placeholder: "placeholder-[#075985]/60",
    buttonHover: "hover:bg-black/10 text-[#0C4A6E]",
    headerBorder: "border-[#7DD3FC]/60",
  },
  lavender: {
    id: "lavender",
    label: "Lavender",
    bg: "bg-[#E9D5FF]",
    dot: "bg-[#C084FC]",
    border: "border-[#D8B4FE]",
    text: "text-[#581C87]",
    placeholder: "placeholder-[#6B21A8]/60",
    buttonHover: "hover:bg-black/10 text-[#581C87]",
    headerBorder: "border-[#D8B4FE]/60",
  },
  charcoal: {
    id: "charcoal",
    label: "Dark",
    bg: "bg-[#18181B]/95 backdrop-blur-xl",
    dot: "bg-[#52525B]",
    border: "border-white/15",
    text: "text-[#F4F4F5]",
    placeholder: "placeholder-white/35",
    buttonHover: "hover:bg-white/15 text-white/80",
    headerBorder: "border-white/10",
  },
  glass: {
    id: "glass",
    label: "Glass",
    bg: "bg-white/20 dark:bg-black/40 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_16px_40px_rgba(0,0,0,0.35)]",
    dot: "bg-gradient-to-br from-white/70 to-white/20 border border-white/60 shadow-xs",
    border: "border-white/35 dark:border-white/20",
    text: "text-zinc-900 dark:text-white font-medium",
    placeholder: "placeholder-zinc-700/60 dark:placeholder-white/50",
    buttonHover: "hover:bg-white/25 dark:hover:bg-white/20 text-zinc-900 dark:text-white",
    headerBorder: "border-white/25 dark:border-white/15",
  },
};

function NotesWidget({ onClose }: { onClose: () => void }) {
  const storageKey = "auxy_widget_pos_notes";
  const [pos, setPos] = useState({ x: 32, y: 450 });
  const [dragging, setDragging] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const currentPosRef = useRef({ x: 32, y: 450 });

  const [noteContent, setNoteContent] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("auxy_widget_notes_text") || "";
      } catch {}
    }
    return "";
  });

  const [stickyColor, setStickyColor] = useState<StickyColor>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("auxy_widget_notes_color") as StickyColor;
        if (saved && STICKY_THEMES[saved]) return saved;
      } catch {}
    }
    return "glass";
  });

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(16, window.innerWidth - 250);
          const maxY = Math.max(60, window.innerHeight - 250);
          const loaded = {
            x: Math.min(Math.max(16, parsed.x), maxX),
            y: Math.min(Math.max(60, parsed.y), maxY),
          };
          setPos(loaded);
          currentPosRef.current = loaded;
        }
      }
    } catch {}
  }, []);

  // Save note on change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteContent(val);
    try {
      localStorage.setItem("auxy_widget_notes_text", val);
    } catch {}
  };

  const handleClearNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteContent("");
    try {
      localStorage.setItem("auxy_widget_notes_text", "");
    } catch {}
  };

  const handleSelectColor = (colorId: StickyColor) => {
    setStickyColor(colorId);
    try {
      localStorage.setItem("auxy_widget_notes_color", colorId);
    } catch {}
  };

  // Buttery-smooth Direct DOM Dragging Engine
  const handlePointerDown = (e: React.PointerEvent) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("textarea") ||
      (e.target as HTMLElement).closest("input")
    ) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: currentPosRef.current.x,
      originY: currentPosRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(8, Math.min(window.innerWidth - 240, dragRef.current.originX + dx));
    const newY = Math.max(48, Math.min(window.innerHeight - 240, dragRef.current.originY + dy));
    currentPosRef.current = { x: newX, y: newY };

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      if (elementRef.current) {
        elementRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
      setPos({ ...currentPosRef.current });
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentPosRef.current));
      } catch {}
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const curTheme = STICKY_THEMES[stickyColor] || STICKY_THEMES.yellow;

  return (
    <div
      ref={elementRef}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        willChange: "transform",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "group fixed top-0 left-0 select-none p-3.5 rounded-2xl border transition-shadow duration-150 cursor-grab active:cursor-grabbing w-[230px] flex flex-col justify-between",
        curTheme.bg,
        curTheme.border,
        "shadow-[0_12px_32px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.18)]",
        dragging
          ? "z-[70] shadow-2xl scale-[1.02] ring-2 ring-black/20"
          : "z-[15]"
      )}
    >
      {/* Figma Sticky Tape Strip Accent */}
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-12 h-3.5 rounded-sm bg-white/45 shadow-sm pointer-events-none backdrop-blur-[1px] border border-white/20 opacity-85" />

      {/* Top Header: Simple 'Notes' title & minimal clear/close buttons */}
      <div
        className={cn(
          "flex items-center justify-between pb-1.5 mb-1 border-b transition-colors",
          curTheme.headerBorder
        )}
      >
        <span className={cn("font-medium text-xs tracking-tight select-none", curTheme.text)}>
          Notes
        </span>

        <div
          className={cn(
            "flex items-center gap-0.5 transition-opacity duration-200",
            dragging
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
          )}
        >
          <button
            type="button"
            onClick={handleClearNote}
            title="Clear note"
            className={cn(
              "p-1 rounded-md transition-colors cursor-pointer opacity-70 hover:opacity-100",
              curTheme.buttonHover
            )}
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close note"
            className={cn(
              "p-1 rounded-md transition-colors cursor-pointer opacity-70 hover:opacity-100",
              curTheme.buttonHover
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Textarea: Clean, borderless note pad */}
      <div className="relative flex-1 cursor-text my-1" onClick={(e) => e.stopPropagation()}>
        <textarea
          value={noteContent}
          onChange={handleTextChange}
          placeholder="Type a note..."
          rows={5}
          className={cn(
            "w-full bg-transparent resize-none outline-none border-0 p-0 font-sans text-xs leading-relaxed focus:ring-0 focus:outline-none transition-colors",
            curTheme.text,
            curTheme.placeholder
          )}
        />
      </div>

      {/* Bottom Color Palette & Drag Handle: Revealed only on hover */}
      <div
        className={cn(
          "pt-1.5 flex items-center justify-between transition-opacity duration-200",
          dragging
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {(Object.keys(STICKY_THEMES) as StickyColor[]).map((cKey) => {
            const t = STICKY_THEMES[cKey];
            const isSelected = stickyColor === cKey;
            return (
              <button
                key={cKey}
                type="button"
                onClick={() => handleSelectColor(cKey)}
                title={t.label}
                className={cn(
                  "size-3.5 rounded-full transition-transform cursor-pointer relative flex items-center justify-center shadow-xs",
                  t.dot,
                  isSelected
                    ? "scale-125 ring-2 ring-black/40 dark:ring-white/60"
                    : "opacity-80 hover:opacity-100 hover:scale-110"
                )}
              />
            );
          })}
        </div>

        <div
          title="Drag Note"
          className={cn(
            "p-0.5 rounded cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 transition-opacity",
            curTheme.text
          )}
        >
          <GripVertical className="size-3" />
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MASTER DESKTOP WIDGETS MANAGER
// ==========================================
export function DesktopWidgetsManager({
  activeWidgets,
  onToggleWidget,
  onOpenSettings,
  onOpenProfile,
}: {
  activeWidgets: ActiveWidgetsState;
  onToggleWidget: (key: WidgetType) => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
}) {
  return (
    <>
      {activeWidgets.clock && (
        <ClockWidget onClose={() => onToggleWidget("clock")} />
      )}
      {activeWidgets.calendar && (
        <CalendarWidget onClose={() => onToggleWidget("calendar")} />
      )}
      {activeWidgets.vinyl && (
        <VinylWidget onClose={() => onToggleWidget("vinyl")} />
      )}
      {activeWidgets.notes && (
        <NotesWidget onClose={() => onToggleWidget("notes")} />
      )}
      {activeWidgets.dock && (
        <DockWidget
          onClose={() => onToggleWidget("dock")}
          onOpenSettings={onOpenSettings}
          onOpenProfile={onOpenProfile}
        />
      )}
    </>
  );
}
