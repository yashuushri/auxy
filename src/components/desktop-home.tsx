"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Bell,
  ChevronLeft,
  Clock,
  Calendar as CalendarIcon,
  Compass,
  Disc,
  ExternalLink,
  Eye,
  Info,
  LayoutGrid,
  LogOut,
  Menu,
  MonitorSpeaker,
  Settings2,
  FileText,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { ExploreDialog } from "@/components/explore-dialog";
import { FloatingWindow } from "@/components/floating-window";
import { ProfileDialog } from "@/components/profile-dialog";
import { RoomBackground } from "@/components/room-background";
import { SettingsDialog } from "@/components/settings-dialog";
import { SpotifyWindow } from "@/components/spotify-window";
import {
  DesktopWidgetsManager,
  type ActiveWidgetsState,
  type WidgetType,
} from "@/components/desktop-widgets";
import {
  ActiveListenersDialog,
  JoinRequestsDialog,
  LeaveRoomDialog,
} from "@/components/listen-together-dialogs";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { FluidGlassButton } from "@/components/ui/fluid-glass-button";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useListenTogether } from "@/context/listen-together-context";
import { sendActivityLog } from "@/lib/activity-logger";
import { isLightBackground } from "@/lib/contrast";
import { usernameKey } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  PLAYER_WINDOW_WIDTH,
  WINDOW_TOP_MIN,
  centeredSinglePlayerLayout,
} from "@/lib/window-layout";

export function DesktopHome() {
  const { user, logout } = useAuth();
  const {
    isHost,
    isListener,
    activeHostUsername,
    participants,
    pendingRequests,
    effectiveBackground,
  } = useListenTogether();

  const [roomOpen, setRoomOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [listenersOpen, setListenersOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<"main" | "widget" | "about">("main");

  // Active desktop draggable widgets state - empty by default on first login / new accounts
  const [activeWidgets, setActiveWidgets] = useState<ActiveWidgetsState>({
    clock: false,
    calendar: false,
    vinyl: false,
    notes: false,
    dock: false,
  });

  const [playerLayout, setPlayerLayout] = useState<
    ReturnType<typeof centeredSinglePlayerLayout> | null
  >(null);

  // Load saved widgets on mount
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`auxy_widgets_${usernameKey(user.username)}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setActiveWidgets({
          clock: Boolean(parsed.clock),
          calendar: Boolean(parsed.calendar),
          vinyl: Boolean(parsed.vinyl),
          notes: Boolean(parsed.notes),
          dock: Boolean(parsed.dock),
        });
      }
    } catch {}
  }, [user]);

  const handleToggleWidget = (type: WidgetType) => {
    setActiveWidgets((prev) => {
      const isEnabling = !prev[type];
      const updated = { ...prev, [type]: isEnabling };
      if (user) {
        try {
          localStorage.setItem(`auxy_widgets_${usernameKey(user.username)}`, JSON.stringify(updated));
        } catch {}
      }

      // Log widget activity to Discord (zero database queries)
      sendActivityLog({
        action: "widget_toggled",
        user,
        metadata: {
          widgetName: type.charAt(0).toUpperCase() + type.slice(1),
          enabled: isEnabling,
        },
      });

      return updated;
    });
  };

  // Listeners count calculation (exclude room host)
  const roomHost = isListener && activeHostUsername ? activeHostUsername : (user?.username || "");
  const activeListeners = participants.filter(
    (p) => p.username.toLowerCase() !== roomHost.toLowerCase()
  );
  const listenerCount = activeListeners.length;

  const userLoggedIn = Boolean(user);

  useEffect(() => {
    if (!userLoggedIn) return;
    setPlayerLayout(centeredSinglePlayerLayout(window.innerWidth, window.innerHeight));

    function handleResize() {
      setPlayerLayout(centeredSinglePlayerLayout(window.innerWidth, window.innerHeight));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [userLoggedIn]);

  if (!user) return null;

  const currentBg = effectiveBackground || user.background;
  const lightRoom = isLightBackground(currentBg);
  const overlayBtn = lightRoom
    ? "border-black/20 bg-white/80 text-neutral-950 hover:bg-white hover:text-neutral-950 shadow-sm"
    : "border-white/25 bg-black/40 text-white hover:bg-black/55 hover:text-white shadow-sm";

  return (
    <div className="page-in relative min-h-svh overflow-hidden bg-black">
      <RoomBackground background={currentBg} user={user} />

      {/* Top Bar Controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          className={cn(
            "pointer-events-auto flex cursor-pointer items-center gap-2 text-sm font-medium tracking-tight",
            lightRoom
              ? "text-neutral-950 drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]"
              : "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
          )}
          aria-label="Reload Auxy"
          onClick={() => window.location.reload()}
        >
          <div className="relative size-5 overflow-hidden rounded-md">
            <Image
              src="/logo.png"
              alt="Auxy Logo"
              fill
              sizes="20px"
              className="object-contain"
              priority
              referrerPolicy="no-referrer"
            />
          </div>
          Auxy
        </button>

        {/* Action Controls */}
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-2 transition-all duration-200",
            sidebarOpen
              ? "opacity-0 pointer-events-none -translate-y-1 scale-95"
              : "opacity-100 scale-100"
          )}
        >
          {/* Host Mode Controls */}
          {isHost && (
            <>
              {/* Bell Join Requests Indicator */}
              {pendingRequests.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRequestsOpen(true)}
                  className="border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 backdrop-blur-md animate-pulse shadow-lg"
                >
                  <Bell className="size-4 mr-1 text-amber-300 animate-bounce" />
                  <span className="font-semibold text-xs">{pendingRequests.length}</span>
                </Button>
              )}
            </>
          )}

          {/* Eye / Active Listeners Button: ONLY visible if listenerCount > 0, direct eye without box/container, count on bottom-right corner */}
          {listenerCount > 0 && (
            <button
              type="button"
              onClick={() => setListenersOpen(true)}
              title={`${listenerCount} listener${listenerCount > 1 ? "s" : ""} in room`}
              className="pointer-events-auto relative p-1.5 text-white/90 hover:text-white transition-all hover:scale-110 cursor-pointer select-none focus:outline-none"
            >
              <Eye className="size-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]" />
              <span className="absolute -bottom-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-black shadow-md border border-black/30 leading-none">
                {listenerCount}
              </span>
            </button>
          )}

          {/* Listener Mode Controls */}
          {isListener && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLeaveOpen(true)}
              className="border-red-500/40 bg-red-500/20 text-red-200 hover:bg-red-500/30 backdrop-blur-md shadow-sm text-xs font-semibold"
            >
              <LogOut className="size-3.5 mr-1 text-red-300" />
              My Room
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className={overlayBtn}
            onClick={() => {
              setSidebarView("main");
              setSidebarOpen(true);
            }}
          >
            <Menu data-icon="inline-start" className="size-4" />
            Menu
          </Button>
        </div>
      </div>

      {/* Floating Spotify Window */}
      {playerLayout ? (
        <FloatingWindow
          title="Player"
          persistKey={`mp_win_player_v2_${usernameKey(user.username)}`}
          defaultX={playerLayout.playerX}
          defaultY={playerLayout.y}
          resizable
          defaultWidth={PLAYER_WINDOW_WIDTH}
          defaultHeight={playerLayout.playerHeight}
          minHeight={258}
          maxTop={WINDOW_TOP_MIN}
        >
          <SpotifyWindow />
        </FloatingWindow>
      ) : null}

      {/* Draggable Aesthetic Desktop Widgets */}
      <DesktopWidgetsManager
        activeWidgets={{
          ...activeWidgets,
          dock: isListener ? false : activeWidgets.dock,
        }}
        onToggleWidget={handleToggleWidget}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />

      {/* Dialogs */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ExploreDialog open={exploreOpen} onOpenChange={setExploreOpen} />
      <AppSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenRoom={() => setRoomOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />
      <SettingsDialog open={roomOpen} onOpenChange={setRoomOpen} />
      <JoinRequestsDialog open={requestsOpen} onOpenChange={setRequestsOpen} />
      <ActiveListenersDialog open={listenersOpen} onOpenChange={setListenersOpen} />
      <LeaveRoomDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.28 }}
              style={{ willChange: "transform" }}
              className="fixed top-0 right-0 z-[90] flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#0c0c14]/95 pt-6 pb-4 pl-6 pr-1.5 text-white shadow-2xl backdrop-blur-md"
            >
              {/* Header: User Profile or Back button for Subviews */}
              {sidebarView === "main" ? (
                <div className="mb-5 pr-4.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {user.avatar && (
                      <Image
                        src={user.avatar}
                        alt={user.displayName || ""}
                        width={40}
                        height={40}
                        className="rounded-full border border-white/20"
                      />
                    )}
                    <div>
                      <h2 className="text-lg font-semibold leading-tight">
                        {user.displayName}
                      </h2>
                      <p className="text-sm text-white/50">@{user.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FluidGlassButton
                      text="Upgrade"
                      onClick={() => setUpgradeOpen(true)}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full text-white hover:bg-white/10 cursor-pointer"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-5 pr-4.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSidebarView("main")}
                    className="flex items-center gap-2 rounded-lg py-1 px-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                    <span className="text-base font-semibold capitalize">
                      {sidebarView === "widget" ? "Widget" : "About"}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <FluidGlassButton
                      text="Upgrade"
                      onClick={() => setUpgradeOpen(true)}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full text-white hover:bg-white/10 cursor-pointer"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* View 1: Main Menu */}
              {sidebarView === "main" && (
                <div className="flex-1 space-y-1.5 overflow-y-auto pr-3.5 ultra-slim-scrollbar">
                  <div className="mb-2 mt-1 px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                    Menu
                  </div>

                  {/* Profile */}
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      setProfileOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer text-left"
                  >
                    <div className="opacity-70 [&>svg]:size-4">
                      <UserRound />
                    </div>
                    Profile
                  </button>

                  {/* Room */}
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      setRoomOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer text-left"
                  >
                    <div className="opacity-70 [&>svg]:size-4">
                      <MonitorSpeaker />
                    </div>
                    Room
                  </button>

                  {/* Join Requests */}
                  {pendingRequests.length > 0 && (
                    <button
                      onClick={() => {
                        setSidebarOpen(false);
                        setRequestsOpen(true);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="size-4" />
                        <span>Join Requests</span>
                      </div>
                      <span className="rounded-full bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5">
                        {pendingRequests.length}
                      </span>
                    </button>
                  )}

                  {/* Widget */}
                  <button
                    onClick={() => setSidebarView("widget")}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer text-left"
                  >
                    <div className="opacity-70 [&>svg]:size-4">
                      <LayoutGrid />
                    </div>
                    Widget
                  </button>

                  {/* Explore */}
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      setExploreOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer text-left"
                  >
                    <div className="opacity-70 [&>svg]:size-4">
                      <Compass />
                    </div>
                    Explore
                  </button>

                  {/* Settings */}
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer text-left"
                  >
                    <div className="opacity-70 [&>svg]:size-4">
                      <Settings2 />
                    </div>
                    Settings
                  </button>

                  {/* About */}
                  <button
                    onClick={() => setSidebarView("about")}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer text-left"
                  >
                    <div className="opacity-70 [&>svg]:size-4">
                      <Info />
                    </div>
                    About
                  </button>
                </div>
              )}

              {/* View 2: Widget Management with Proper Visual Widget Cards */}
              {sidebarView === "widget" && (
                <div className="flex-1 space-y-3.5 overflow-y-auto pr-3.5 ultra-slim-scrollbar text-xs">
                  <p className="px-1 text-[11px] text-white/40 leading-relaxed">
                    Click any widget preview below to toggle and pin it to your desktop. Drag them anywhere to customize your setup.
                  </p>

                  <div className="space-y-3">
                    {/* 1. Aesthetic Clock Widget Preview */}
                    <div
                      onClick={() => handleToggleWidget("clock")}
                      className={cn(
                        "group relative rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border",
                        activeWidgets.clock
                          ? "bg-white/[0.08] border-white/30 shadow-lg shadow-black/40 ring-1 ring-white/20"
                          : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5 text-white/70" />
                          <span className="font-semibold text-white text-xs">Aesthetic Clock</span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-colors",
                            activeWidgets.clock
                              ? "bg-white text-black"
                              : "bg-white/10 text-white/40"
                          )}
                        >
                          {activeWidgets.clock ? "ON" : "OFF"}
                        </span>
                      </div>

                      {/* Mini Visual Representation (Transparent Background, No Date, No Seconds) */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex flex-col items-center justify-center gap-1">
                        <div className="font-mono text-xl font-black tracking-tight text-white flex items-baseline">
                          12<span className="text-white mx-0.5 font-bold">:</span>45
                          <span className="text-white/70 text-[10px] ml-1.5 font-sans font-bold">PM</span>
                        </div>
                        <div className="text-[9px] font-mono text-white/40">
                          4 Themes • 3-Dot Options • HUD
                        </div>
                      </div>
                    </div>

                    {/* 2. Aesthetic Glass Calendar Widget Preview */}
                    <div
                      onClick={() => handleToggleWidget("calendar")}
                      className={cn(
                        "group relative rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border",
                        activeWidgets.calendar
                          ? "bg-white/[0.08] border-white/30 shadow-lg shadow-black/40 ring-1 ring-white/20"
                          : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="size-3.5 text-white/70" />
                          <span className="font-semibold text-white text-xs">Aesthetic Calendar</span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-colors",
                            activeWidgets.calendar
                              ? "bg-white text-black"
                              : "bg-white/10 text-white/40"
                          )}
                        >
                          {activeWidgets.calendar ? "ON" : "OFF"}
                        </span>
                      </div>

                      {/* Mini Calendar Visual Preview */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 flex flex-col items-center gap-1.5">
                        <div className="flex items-center justify-between w-full px-1 text-[10px] font-bold text-white/80">
                          <span>SEPTEMBER</span>
                          <span className="font-mono text-white/40 text-[9px]">2026</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1 w-full text-center text-[8px] font-mono text-white/30 font-bold">
                          <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1 w-full text-center text-[8px] font-mono text-white/60">
                          <span className="text-white/20">30</span>
                          <span>1</span>
                          <span>2</span>
                          <span className="bg-white text-black font-black rounded-full shadow-sm">3</span>
                          <span>4</span>
                          <span>5</span>
                          <span>6</span>
                        </div>
                        <div className="text-[9px] font-mono text-white/40 mt-0.5">
                          Frosted Glass • Month Navigation
                        </div>
                      </div>
                    </div>

                    {/* 2. Aesthetic Vinyl Widget Preview */}
                    <div
                      onClick={() => handleToggleWidget("vinyl")}
                      className={cn(
                        "group relative rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border",
                        activeWidgets.vinyl
                          ? "bg-white/[0.08] border-white/30 shadow-lg shadow-black/40 ring-1 ring-white/20"
                          : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <Disc className="size-3.5 text-white/70" />
                          <span className="font-semibold text-white text-xs">Aesthetic Vinyl</span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-colors",
                            activeWidgets.vinyl
                              ? "bg-white text-black"
                              : "bg-white/10 text-white/40"
                          )}
                        >
                          {activeWidgets.vinyl ? "ON" : "OFF"}
                        </span>
                      </div>

                      {/* Mini Visual Representation */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-center justify-center gap-4">
                        <div className="relative size-12 rounded-full border border-white/20 bg-neutral-900 shadow-inner flex items-center justify-center">
                          {/* Grooves */}
                          <div className="absolute inset-1 rounded-full border border-white/10" />
                          <div className="absolute inset-2.5 rounded-full border border-white/10" />
                          <div className="size-4 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 border border-white/30 flex items-center justify-center">
                            <div className="size-1 rounded-full bg-black" />
                          </div>
                          {/* Mini tonearm needle */}
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-5 border-t border-r border-white/60 rotate-12 origin-top-right rounded-tr" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-[11px] font-semibold text-white/90">Hi-Fi Turntable</span>
                          <span className="text-[9px] text-white/40">Mechanical Tonearm • Player Sync</span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Figma-Inspired Sticky Notes Widget Preview */}
                    <div
                      onClick={() => handleToggleWidget("notes")}
                      className={cn(
                        "group relative rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border",
                        activeWidgets.notes
                          ? "bg-white/[0.08] border-white/30 shadow-lg shadow-black/40 ring-1 ring-white/20"
                          : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5 text-white/70" />
                          <span className="font-semibold text-white text-xs">Notes</span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-colors",
                            activeWidgets.notes
                              ? "bg-white text-black"
                              : "bg-white/10 text-white/40"
                          )}
                        >
                          {activeWidgets.notes ? "ON" : "OFF"}
                        </span>
                      </div>

                      {/* Mini Visual Representation - Figma Sticky Note Style */}
                      <div className="relative rounded-xl border border-[#EADB5F]/60 bg-[#FEF387] p-2.5 text-left space-y-1 shadow-sm overflow-hidden">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 rounded-xs bg-white/60 shadow-xs" />
                        <div className="h-1.5 w-3/4 rounded-full bg-[#292524]/60" />
                        <div className="h-1.5 w-full rounded-full bg-[#292524]/30" />
                        <div className="h-1.5 w-1/2 rounded-full bg-[#292524]/30" />
                        <div className="pt-1 flex items-center justify-between text-[9px] font-mono text-[#292524]/60">
                          <span>Sticky Note</span>
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-[#FACC15]" />
                            <span className="size-1.5 rounded-full bg-[#38BDF8]" />
                            <span className="size-1.5 rounded-full bg-[#4ADE80]" />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. macOS Aesthetic Dock Widget Preview (Sabse Neeche) */}
                    <div
                      onClick={() => handleToggleWidget("dock")}
                      className={cn(
                        "group relative rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border",
                        activeWidgets.dock
                          ? "bg-white/[0.08] border-white/30 shadow-lg shadow-black/40 ring-1 ring-white/20"
                          : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="size-3.5 text-white/70" />
                          <span className="font-semibold text-white text-xs">macOS Dock</span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-colors",
                            activeWidgets.dock
                              ? "bg-white text-black"
                              : "bg-white/10 text-white/40"
                          )}
                        >
                          {activeWidgets.dock ? "ON" : "OFF"}
                        </span>
                      </div>

                      {/* Mini Visual Representation - macOS Dock Style with Magnifying Icons */}
                      <div className="relative rounded-xl border border-white/15 bg-white/10 backdrop-blur-md p-2 flex items-end justify-center gap-1.5 shadow-sm overflow-hidden">
                        <div className="size-4.5 rounded-md bg-[#FF0000] shadow-xs" />
                        <div className="size-5 rounded-md bg-[#5865F2] -translate-y-0.5 shadow-sm" />
                        <div className="size-5.5 rounded-md bg-[#1e2327] -translate-y-1 shadow-md scale-105" />
                        <div className="size-5 rounded-md bg-[#1DB954] -translate-y-0.5 shadow-sm" />
                        <div className="size-4.5 rounded-md bg-black shadow-xs" />
                        <div className="size-4.5 rounded-md bg-[#e50914] shadow-xs" />
                        <div className="w-[1px] h-3.5 bg-white/20 self-center" />
                        <div className="size-4.5 rounded-md bg-gradient-to-tr from-rose-500 to-amber-400 shadow-xs" />
                        <div className="size-4.5 rounded-md bg-slate-500 shadow-xs" />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[9px] text-white/40">
                        <span>Parabolic Magnification</span>
                        <span>8 Apps (6 Links)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* View 3: Pure Boxless Text About & Comprehensive Specifications */}
              {sidebarView === "about" && (
                <div className="flex-1 space-y-6 overflow-y-auto pr-3.5 ultra-slim-scrollbar text-xs">
                  {/* Header Identity (No Box) */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-2.5">
                      <div className="relative size-6 overflow-hidden rounded-md border border-white/20 shrink-0">
                        <Image
                          src="/logo.png"
                          alt="Auxy Logo"
                          fill
                          sizes="24px"
                          className="object-contain"
                        />
                      </div>
                      <h3 className="font-bold text-white text-base tracking-tight">Auxy OS</h3>
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      High-fidelity desktop audio workspace, lossless playlist engine, and real-time synchronized listening environment.
                    </p>
                  </div>

                  {/* Releases (Clean Text, No Box, Beta 1.2 at the top, Static White Dot for Beta 1.01) */}
                  <div className="space-y-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Releases
                    </div>

                    <div className="space-y-2">
                      {/* Beta 1.2 - Top, Future Release, Low visibility */}
                      <div className="text-[11px] text-white/25 select-none space-y-0.5">
                        <div className="flex items-center justify-between font-medium">
                          <span>Beta 1.2</span>
                          <span className="text-[10px] font-mono">Planned</span>
                        </div>
                        <p className="text-[10px] text-white/20">
                          Spatial soundstage engine, Mobile PWA companion remote, dynamic canvas shaders.
                        </p>
                      </div>

                      {/* Beta 1.01 - Current Active Release (Static White Dot & White Active) */}
                      <div className="text-[11px] text-white/90 space-y-0.5 pt-1">
                        <div className="flex items-center justify-between font-semibold text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-white" />
                            <span>Beta 1.01</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/90 font-semibold">Active</span>
                        </div>
                        <p className="text-[10px] text-white/60">
                          Draggable aesthetic desktop widgets, real-time ambient lofi synthesizer, dynamic Listen Together broadcast.
                        </p>
                      </div>

                      {/* Beta 1.0 - Past Release, Low visibility */}
                      <div className="text-[11px] text-white/25 select-none space-y-0.5 pt-1">
                        <div className="flex items-center justify-between font-medium">
                          <span>Beta 1.0</span>
                          <span className="text-[10px] font-mono">Genesis</span>
                        </div>
                        <p className="text-[10px] text-white/20">
                          Lossless YouTube streaming queue, synchronized room protocol, floating window manager.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Developer (Clean Text, No Box) */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Developer & Creator
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-white/90">
                        <a
                          href="https://discord.gg/RjHq5zWzbh"
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-white hover:underline transition-colors"
                        >
                          Shree.
                        </a>
                        <span className="text-[10px] text-white/40">Design & User Experience</span>
                      </div>
                    </div>
                  </div>

                  {/* Auxy Audio API (Deep Acoustic Engine Architecture) */}
                  <div className="space-y-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Auxy Audio API & Acoustics
                    </div>
                    <div className="space-y-2 text-[11px] text-white/60 leading-relaxed">
                      <p>
                        <span className="text-white font-medium">• True 3D Audio & Dolby Atmos:</span> Agar true 3D audio, heavy clean bass, aur crystal clear sound chahiye, toh Dolby Atmos ka koi jawab nahi hai. Yeh conventional channels (Left-Right) ko chhodkar sound ko dynamic audio objects ki tarah treat karta hai. Auxy mein Dolby Atmos support bhi integrate kiya gaya hai jo Premium version mein available hai.
                      </p>
                      <p>
                        <span className="text-white font-medium">• 4D & 8D Spatial Audio:</span> 8D ya 4D audio aapke saste se saste headphone par bhi binaural mapping engine aur HRTF filters ka use karke sound ko left-to-right aur front-to-back rotate kar deta hai. 8D spatial rotating audio Premium mein hai, par 4D audio free mein sabhi ke liye fully available hai.
                      </p>
                      <p>
                        <span className="text-white font-medium">• Ogg Vorbis & 2D Playback:</span> Ogg Vorbis filhal traditional 2D sound output deliver karta hai aur default par Auxy OS mein 4D audio hi set rehta hai. Yeh sirf standard stereo playback aur basic software equalizer setting ke liye hi upyogi hai.
                      </p>
                    </div>
                  </div>

                  {/* Core Capabilities */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Core Capabilities
                    </div>
                    <div className="space-y-1.5 text-[11px] text-white/60 leading-relaxed">
                      <p>
                        <span className="text-white font-medium">• Lossless Streaming:</span> High-bitrate YouTube stream pipeline with smart buffering and zero playback interruptions.
                      </p>
                      <p>
                        <span className="text-white font-medium">• Synchronized Broadcast:</span> Real-time Listen Together room synchronization with host-lock precision and listener approval controls.
                      </p>
                      <p>
                        <span className="text-white font-medium">• Window Architecture:</span> Draggable, resizable, floating desktop windows that remember positions and sizes across sessions.
                      </p>
                      <p>
                        <span className="text-white font-medium">• Web Audio Synthesis:</span> Procedural rain, crackling campfire, and vintage vinyl noise generators running natively in-browser.
                      </p>
                      <p>
                        <span className="text-white font-medium">• Spectrum Visualizer:</span> 60 FPS hardware-accelerated audio frequency analysis and reactive waveforms.
                      </p>
                    </div>
                  </div>

                  {/* Digital Signal Processing (DSP) & Engine Specs */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Audio Engine & DSP Pipeline
                    </div>
                    <div className="space-y-1.5 text-[11px] text-white/50 leading-relaxed">
                      <p>
                        Auxy Audio API is powered by a high-precision Web Audio DSP graph featuring multi-stage Biquad filters, low-noise gain staging, and dynamic compressor limiters preventing signal clipping.
                      </p>
                      <p>
                        Drift compensation algorithms continuously calibrate host and listener playback timestamps to preserve sub-second alignment regardless of network variance.
                      </p>
                    </div>
                  </div>

                  {/* Privacy & Local-First Philosophy */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Philosophy & Privacy
                    </div>
                    <div className="space-y-1.5 text-[11px] text-white/50 leading-relaxed">
                      <p>
                        Auxy is built on local-first principles. Your playlists, library configurations, and session preferences remain stored entirely within your browser environment.
                      </p>
                      <p>
                        No third-party trackers, no behavioral analytics, and zero advertising overlays. Designed purely for deep focus and shared listening.
                      </p>
                    </div>
                  </div>

                  {/* System Specifications */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      System Specifications
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 text-[10px] text-white/40">
                      <div>Framework: <span className="text-white/70">Next.js 15</span></div>
                      <div>Engine: <span className="text-white/70">Auxy Audio API</span></div>
                      <div>Spatializer: <span className="text-white/70">4D / 8D HRTF</span></div>
                      <div>Equalizer: <span className="text-white/70">10-Band Biquad</span></div>
                      <div>Styling: <span className="text-white/70">Tailwind CSS</span></div>
                      <div>Animation: <span className="text-white/70">Framer Motion</span></div>
                    </div>
                  </div>

                  {/* Community Discord Link */}
                  <div className="pt-2 pb-2">
                    <a
                      href="https://discord.gg/z6ger9yRs"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-all cursor-pointer"
                    >
                      <ExternalLink className="size-3.5 opacity-70" />
                      <span>Join Auxy Discord Server</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Sidebar Footer with Log out / Back to Menu and Developer / Version row */}
              <div className="mt-auto border-t border-white/10 pt-2.5 pb-1 pr-4.5 flex flex-col gap-2">
                {sidebarView === "main" ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-400 hover:bg-red-400/10 hover:text-red-300 h-8 text-xs cursor-pointer"
                    onClick={() => {
                      setSidebarOpen(false);
                      logout();
                    }}
                  >
                    <LogOut className="mr-2 size-3.5" />
                    Log out
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white/60 hover:bg-white/10 hover:text-white h-8 text-xs cursor-pointer"
                    onClick={() => setSidebarView("main")}
                  >
                    <ChevronLeft className="mr-1.5 size-3.5" />
                    Back to Menu
                  </Button>
                )}

                <div className="flex items-center justify-between px-1 text-[10px] select-none text-white/20">
                  <div className="flex items-center gap-1">
                    <span>Developer •</span>
                    <a
                      href="https://discord.gg/RjHq5zWzbh"
                      target="_blank"
                      rel="noreferrer"
                      className="text-white/20 hover:text-white/40 transition-colors"
                    >
                      Shree.
                    </a>
                  </div>
                  <div className="text-white/20">
                    Version • Beta1.01
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom right indicator: Host username when in Listen Together */}
      {isListener && activeHostUsername && (
        <div className="fixed bottom-3 right-4 z-40 pointer-events-none select-none text-xs text-white/50 font-medium tracking-wide">
          @{activeHostUsername}
        </div>
      )}
    </div>
  );
}
