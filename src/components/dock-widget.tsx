"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "motion/react";
import {
  RotateCcw,
  Check,
  X,
  Sliders,
  Upload,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useListenTogether } from "@/context/listen-together-context";
import { defaultAvatar } from "@/lib/storage";

// ==========================================
// TYPES & APP DEFINITIONS
// ==========================================
export interface DockApp {
  id: string;
  name: string;
  url: string;
  iconType: "empty" | "url";
  iconUrl?: string;
  isFixed?: boolean;
}

export const SETTINGS_LOGO_URL =
  "https://i.pinimg.com/1200x/b3/69/c2/b369c2fae9c5c1ca4b7fad6a8353ad57.jpg";

const DOCK_STORAGE_KEY = "auxy_dock_apps_local_v3";

// 6 Default apps: Uniform Black & White "No Logo / Empty Slot" placeholder
export const DEFAULT_DOCK_APPS: DockApp[] = [
  {
    id: "custom-app-1",
    name: "App 1",
    url: "",
    iconType: "empty",
    iconUrl: "",
    isFixed: false,
  },
  {
    id: "custom-app-2",
    name: "App 2",
    url: "",
    iconType: "empty",
    iconUrl: "",
    isFixed: false,
  },
  {
    id: "custom-app-3",
    name: "App 3",
    url: "",
    iconType: "empty",
    iconUrl: "",
    isFixed: false,
  },
  {
    id: "custom-app-4",
    name: "App 4",
    url: "",
    iconType: "empty",
    iconUrl: "",
    isFixed: false,
  },
  {
    id: "custom-app-5",
    name: "App 5",
    url: "",
    iconType: "empty",
    iconUrl: "",
    isFixed: false,
  },
  {
    id: "custom-app-6",
    name: "App 6",
    url: "",
    iconType: "empty",
    iconUrl: "",
    isFixed: false,
  },
  // 2 Fixed System Apps (RIGHT SIDE: Settings, then Profile at the extreme right)
  {
    id: "system-settings",
    name: "Settings",
    url: "",
    iconType: "url",
    iconUrl: SETTINGS_LOGO_URL,
    isFixed: true,
  },
  {
    id: "system-profile",
    name: "My Profile",
    url: "",
    iconType: "empty",
    isFixed: true,
  },
];

// Helper to downscale and compress desktop image upload to keep localStorage lightweight
function compressImageFile(file: File, maxSize = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Clean webp or png data url
        resolve(canvas.toDataURL("image/webp", 0.9));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// APP ICON RENDERER
// ==========================================
function DockIconRenderer({
  app,
  userAvatar,
  className,
}: {
  app: DockApp;
  userAvatar?: string;
  className?: string;
}) {
  // 1. Settings App
  if (app.id === "system-settings") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={SETTINGS_LOGO_URL}
        alt="Settings"
        className={cn(
          "w-full h-full object-cover rounded-[22%] shadow-[0_2px_6px_rgba(0,0,0,0.3)] pointer-events-none select-none ring-1 ring-white/15",
          className
        )}
      />
    );
  }

  // 2. Profile PFP App (Extreme Right)
  if (app.id === "system-profile") {
    const avatarSrc = userAvatar || defaultAvatar(app.name || "User");
    return (
      <div className="w-full h-full rounded-[22%] bg-zinc-800 flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.3)] relative overflow-hidden ring-1 ring-white/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt={app.name}
          className="w-full h-full object-cover rounded-[22%] pointer-events-none select-none"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = defaultAvatar(
              app.name || "User"
            );
          }}
        />
        <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/25 to-transparent pointer-events-none rounded-t-[22%]" />
      </div>
    );
  }

  // 3. Custom Image URL or Uploaded Desktop Image
  if (app.iconType === "url" && app.iconUrl && app.iconUrl.trim()) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={app.iconUrl}
        alt={app.name}
        className={cn(
          "w-full h-full object-cover rounded-[22%] shadow-[0_2px_6px_rgba(0,0,0,0.3)] pointer-events-none select-none ring-1 ring-white/15",
          className
        )}
        onError={(e) => {
          // If custom image breaks, show placeholder
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // 4. Default 6 apps: Uniform Black & White "Empty / No Logo" Icon
  return (
    <div
      className={cn(
        "w-full h-full rounded-[22%] bg-[#121215] border border-white/15 flex items-center justify-center relative overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.3)]",
        className
      )}
    >
      {/* Subtle top gloss reflection */}
      <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/12 to-transparent pointer-events-none rounded-t-[22%]" />

      {/* Monochrome Minimalist "No Logo" Emblem */}
      <div className="size-[44%] rounded-lg border border-dashed border-white/25 flex items-center justify-center relative z-10">
        <div className="size-1.5 rounded-full bg-white/40" />
      </div>
    </div>
  );
}

// ==========================================
// 120 FPS ZERO-LAG DOCK ITEM COMPONENT
// ==========================================
function DockItemComponent({
  app,
  index,
  mouseX,
  getItemCenter,
  userAvatar,
  isActive,
  isBouncing,
  onClick,
}: {
  app: DockApp;
  index: number;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  getItemCenter: (i: number) => number;
  userAvatar?: string;
  isActive: boolean;
  isBouncing: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Exact macOS Monterey base size: 46px at rest, perfectly contained inside the 58px tray!
  const baseWidth = 46;
  const distanceLimit = baseWidth * 4.5; // ~207px influence zone

  // Pure algebraic distance: ZERO getBoundingClientRect calls during mouse movement!
  const distance = useTransform(mouseX, (val: number) => {
    if (val === Infinity) return Infinity;
    const center = getItemCenter(index);
    if (!center) return Infinity;
    return val - center;
  });

  // Authentic macOS Parabolic Expansion Curve (PuruVJ macos-web)
  const distanceInput = [
    -distanceLimit,
    -distanceLimit / 1.3,
    -distanceLimit / 2,
    0,
    distanceLimit / 2,
    distanceLimit / 1.3,
    distanceLimit,
  ];

  const widthOutput = [
    baseWidth,
    baseWidth * 1.15,
    baseWidth * 1.38,
    baseWidth * 1.72, // ~79px peak magnification
    baseWidth * 1.38,
    baseWidth * 1.15,
    baseWidth,
  ];

  const widthSync = useTransform(distance, distanceInput, widthOutput);

  // Buttery 120 FPS hardware spring physics
  const animatedWidth = useSpring(widthSync, {
    mass: 0.08,
    stiffness: 240,
    damping: 18,
  });

  return (
    <div
      data-dock-item
      className="relative flex flex-col items-center justify-end overflow-visible shrink-0 pb-0.5"
    >
      {/* Floating macOS Monterey Frosted Glass Tooltip (ONLY APP NAME) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.96 }}
            transition={{ duration: 0.1 }}
            className="absolute -top-9 px-2.5 py-0.5 rounded-md text-[11.5px] font-medium tracking-tight whitespace-nowrap z-50 pointer-events-none select-none shadow-[0_4px_14px_rgba(0,0,0,0.35)] bg-zinc-900/90 text-white backdrop-blur-xl border border-white/20"
          >
            {app.name}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Magnifying Button */}
      <motion.button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: animatedWidth,
          height: animatedWidth,
        }}
        className={cn(
          "relative cursor-pointer outline-none focus:outline-none flex items-center justify-center select-none origin-bottom",
          isBouncing && "animate-mac-bounce"
        )}
      >
        <div className="w-full h-full relative transition-transform duration-75 ease-out group-hover:scale-[1.02]">
          <DockIconRenderer app={app} userAvatar={userAvatar} />
        </div>
      </motion.button>

      {/* Active Dot indicator below app (macOS style) */}
      <div
        className={cn(
          "w-1 h-1 rounded-full transition-all duration-200 mt-1",
          isActive
            ? "bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)] scale-100"
            : "bg-transparent scale-0"
        )}
      />
    </div>
  );
}

// ==========================================
// MASTER DOCK WIDGET COMPONENT
// ==========================================
export function DockWidget({
  onClose,
  onOpenSettings,
  onOpenProfile,
}: {
  onClose?: () => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
}) {
  const { user } = useAuth();
  const { isListener } = useListenTogether();

  // If user is a listener in Listen Together, dock must NOT be visible!
  const dockRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemCentersRef = useRef<number[]>([]);

  // Load from local storage (strictly local storage, client-side only)
  const [apps, setApps] = useState<DockApp[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(DOCK_STORAGE_KEY);
        if (saved) {
          const parsed: DockApp[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= 6) {
            const custom = parsed.filter(
              (a) =>
                !a.isFixed &&
                a.id !== "system-settings" &&
                a.id !== "system-profile"
            );
            if (custom.length >= 6) {
              return [
                ...custom.slice(0, 6),
                {
                  id: "system-settings",
                  name: "Settings",
                  url: "",
                  iconType: "url",
                  iconUrl: SETTINGS_LOGO_URL,
                  isFixed: true,
                },
                {
                  id: "system-profile",
                  name: user?.displayName || user?.username || "My Profile",
                  url: "",
                  iconType: "empty",
                  isFixed: true,
                },
              ];
            }
          }
        }
      } catch {}
    }
    return DEFAULT_DOCK_APPS.map((a) => {
      if (a.id === "system-profile") {
        return {
          ...a,
          name: user?.displayName || user?.username || "My Profile",
        };
      }
      return a;
    });
  });

  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [bouncingAppId, setBouncingAppId] = useState<string | null>(null);

  // Customize Modal State
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [selectedAppIndex, setSelectedAppIndex] = useState(0); // 0..5
  const [isUploading, setIsUploading] = useState(false);

  // 120 FPS hardware-accelerated mouse motion value
  const mouseX = useMotionValue<number>(Infinity);

  // Pre-calculate centers on enter or resize to eliminate layout thrashing
  const updateItemCenters = useCallback(() => {
    if (!dockRef.current) return;
    const items =
      dockRef.current.querySelectorAll<HTMLElement>("[data-dock-item]");
    itemCentersRef.current = Array.from(items).map((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
  }, []);

  useEffect(() => {
    updateItemCenters();
    window.addEventListener("resize", updateItemCenters);
    return () => window.removeEventListener("resize", updateItemCenters);
  }, [updateItemCenters]);

  // Keep Profile name updated when user logs in/changes name
  useEffect(() => {
    setApps((prev) =>
      prev.map((a) => {
        if (a.id === "system-profile") {
          return {
            ...a,
            name: user?.displayName || user?.username || "My Profile",
          };
        }
        return a;
      })
    );
  }, [user?.displayName, user?.username]);

  // Save dock data strictly in localStorage
  const saveAppsToLocalStorage = (newApps: DockApp[]) => {
    setApps(newApps);
    try {
      localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(newApps));
    } catch (e) {
      console.error("Failed to save dock to local storage", e);
    }
  };

  const getItemCenter = useCallback((index: number) => {
    return itemCentersRef.current[index] ?? 0;
  }, []);

  const handleAppClick = (app: DockApp, e: React.MouseEvent) => {
    e.stopPropagation();

    // Trigger iconic macOS bounce
    setBouncingAppId(app.id);
    setActiveAppId(app.id);
    setTimeout(() => {
      setBouncingAppId(null);
    }, 850);

    // 1. Settings App Click -> Opens Dock Settings / Customization
    if (app.id === "system-settings") {
      setIsCustomizeModalOpen(true);
      return;
    }

    // 2. Profile App Click -> Opens Public User Profile
    if (app.id === "system-profile") {
      if (onOpenProfile) {
        onOpenProfile();
      } else if (onOpenSettings) {
        onOpenSettings();
      }
      return;
    }

    // 3. 6 Customizable Apps
    if (app.url && app.url.trim()) {
      let finalUrl = app.url.trim();
      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        finalUrl = `https://${finalUrl}`;
      }
      try {
        window.open(finalUrl, "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error("Failed to open dock url", err);
      }
    } else {
      // If no URL configured yet, open dock customization for this app
      const idx = apps.findIndex((a) => a.id === app.id);
      if (idx >= 0 && idx < 6) setSelectedAppIndex(idx);
      setIsCustomizeModalOpen(true);
    }
  };

  // Handle uploading desktop image
  const handleDesktopImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const compressedDataUrl = await compressImageFile(file, 160);
      const updated = apps.map((a, i) =>
        i === selectedAppIndex
          ? { ...a, iconType: "url" as const, iconUrl: compressedDataUrl }
          : a
      );
      setApps(updated);
    } catch (err) {
      console.error("Failed to upload desktop image", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Dock is completely hidden for listeners in Listen Together!
  if (isListener) {
    return null;
  }

  const customApps = apps.filter((a) => !a.isFixed).slice(0, 6);
  const activeCustomApp = customApps[selectedAppIndex] || customApps[0];

  return (
    <>
      {/* Iconic macOS Bounce Keyframes */}
      <style jsx global>{`
        @keyframes mac-dock-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          20% {
            transform: translateY(-28px);
          }
          40% {
            transform: translateY(-6px);
          }
          60% {
            transform: translateY(-14px);
          }
          80% {
            transform: translateY(-3px);
          }
        }
        .animate-mac-bounce {
          animation: mac-dock-bounce 0.82s cubic-bezier(0.28, 0.84, 0.42, 1);
        }
      `}</style>

      {/* Hidden file input for desktop upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleDesktopImageUpload}
      />

      {/* FIXED BOTTOM CENTER DOCK CONTAINER */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40 select-none pointer-events-auto flex items-end justify-center">
        {/* macOS Monterey Frosted Glass Dock Tray */}
        <div
          ref={dockRef}
          onMouseEnter={() => {
            updateItemCenters();
          }}
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          className={cn(
            "relative flex items-end gap-1.5 px-2.5 pb-0.5 pt-1 rounded-[18px] overflow-visible",
            // Fixed height: NEVER stretches vertically when hovered
            "h-[58px] min-h-[58px] max-h-[58px]",
            // Translucent Frosted Glass Aesthetic (Clean, crisp macOS glass)
            "bg-white/20 dark:bg-black/40 backdrop-blur-2xl backdrop-saturate-150",
            "border border-white/35 dark:border-white/15",
            "shadow-[0_16px_40px_rgba(0,0,0,0.4),inset_0_0.5px_0_rgba(255,255,255,0.4)]"
          )}
        >
          {/* Subtle close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Dock"
              className="group/close absolute -top-2 -right-2 size-4.5 rounded-full bg-black/60 hover:bg-black/90 text-white/70 hover:text-white border border-white/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity shadow-md cursor-pointer z-30"
            >
              <X className="size-2.5" />
            </button>
          )}

          {apps.map((app, index) => {
            const isBouncing = bouncingAppId === app.id;
            const isActive = activeAppId === app.id;

            return (
              <React.Fragment key={app.id}>
                {/* macOS Divider before Fixed System Apps on the right */}
                {app.isFixed && !apps[index - 1]?.isFixed && (
                  <div className="w-[1px] h-7 bg-white/25 dark:bg-white/15 mx-1 self-center rounded-full pointer-events-none shrink-0" />
                )}

                <DockItemComponent
                  app={app}
                  index={index}
                  mouseX={mouseX}
                  getItemCenter={getItemCenter}
                  userAvatar={user?.avatar}
                  isActive={isActive}
                  isBouncing={isBouncing}
                  onClick={(e) => handleAppClick(app, e)}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ==========================================
          CUSTOMIZE DOCK APPS MODAL
      ========================================== */}
      {isCustomizeModalOpen && activeCustomApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsCustomizeModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-900/95 dark:bg-zinc-950/95 border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4 text-white backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-white/80" />
                <h3 className="font-semibold text-sm leading-tight">
                  Dock Settings & Apps
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* TOP 6 APPS SELECTOR BAR */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                Select App to Customize
              </p>
              <div className="grid grid-cols-6 gap-1.5 bg-white/[0.03] p-1.5 rounded-2xl border border-white/10">
                {customApps.map((cApp, idx) => {
                  const isSelected = selectedAppIndex === idx;
                  return (
                    <button
                      key={cApp.id}
                      type="button"
                      onClick={() => setSelectedAppIndex(idx)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl transition-all cursor-pointer relative",
                        isSelected
                          ? "bg-white/20 border border-white/40 shadow-md ring-1 ring-white/30"
                          : "hover:bg-white/[0.06] border border-transparent"
                      )}
                    >
                      <div className="size-7">
                        <DockIconRenderer app={cApp} />
                      </div>
                      <span className="text-[10px] font-medium text-white/90 truncate w-full text-center">
                        {cApp.name || `App ${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected App Form Editor */}
            <div className="space-y-3.5 pt-0.5">
              {/* App Name */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  App Name
                </label>
                <input
                  type="text"
                  value={activeCustomApp.name}
                  onChange={(e) => {
                    const updated = apps.map((a) =>
                      a.id === activeCustomApp.id
                        ? { ...a, name: e.target.value }
                        : a
                    );
                    setApps(updated);
                  }}
                  placeholder="e.g. YouTube, Discord, Website..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/40 outline-none transition-all"
                />
              </div>

              {/* Hyperlink */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Hyperlink URL (Opens on click)
                </label>
                <input
                  type="url"
                  value={activeCustomApp.url}
                  onChange={(e) => {
                    const updated = apps.map((a) =>
                      a.id === activeCustomApp.id
                        ? { ...a, url: e.target.value }
                        : a
                    );
                    setApps(updated);
                  }}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/40 outline-none transition-all"
                />
              </div>

              {/* App Icon Image (Compact URL box + Add through desktop button) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/70">
                  App Icon Image
                </label>

                {/* Input Controls Row */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={activeCustomApp.iconUrl || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = apps.map((a) =>
                          a.id === activeCustomApp.id
                            ? {
                                ...a,
                                iconType: val.trim()
                                  ? ("url" as const)
                                  : ("empty" as const),
                                iconUrl: val,
                              }
                            : a
                        );
                        setApps(updated);
                      }}
                      placeholder="Paste Image URL..."
                      className="w-full pl-2.5 pr-2 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/40 outline-none"
                    />
                  </div>

                  {/* Add through desktop button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-medium text-white/90 border border-white/15 transition-all shrink-0 cursor-pointer"
                    title="Upload image from desktop / computer"
                  >
                    <Upload className="size-3.5 text-white/80" />
                    <span>{isUploading ? "Adding..." : "From Desktop"}</span>
                  </button>

                  {/* Clear / Reset to Empty */}
                  {activeCustomApp.iconUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = apps.map((a) =>
                          a.id === activeCustomApp.id
                            ? {
                                ...a,
                                iconType: "empty" as const,
                                iconUrl: "",
                              }
                            : a
                        );
                        setApps(updated);
                      }}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
                      title="Remove image and reset to default empty logo"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  const defaultItem = DEFAULT_DOCK_APPS.find(
                    (d) => d.id === activeCustomApp.id
                  );
                  if (defaultItem) {
                    const updated = apps.map((a) =>
                      a.id === activeCustomApp.id ? { ...defaultItem } : a
                    );
                    setApps(updated);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizeModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveAppsToLocalStorage(apps);
                    setIsCustomizeModalOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  <Check className="size-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
