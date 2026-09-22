"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Bell,
  Compass,
  Eye,
  LogOut,
  Menu,
  MonitorSpeaker,
  Settings2,
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
  ActiveListenersDialog,
  JoinRequestsDialog,
  LeaveRoomDialog,
} from "@/components/listen-together-dialogs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useListenTogether } from "@/context/listen-together-context";
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
  const [playerLayout, setPlayerLayout] = useState<
    ReturnType<typeof centeredSinglePlayerLayout> | null
  >(null);

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
            onClick={() => setSidebarOpen(true)}
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
              className="fixed top-0 right-0 z-[90] flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#0c0c14]/95 p-6 text-white shadow-2xl backdrop-blur-md"
            >
              <div className="mb-8 flex items-center justify-between">
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
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full text-white hover:bg-white/10 cursor-pointer"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="-mr-2 flex-1 space-y-1 overflow-y-auto pr-2 slim-transparent-scrollbar">
                <div className="mb-2 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Menu
                </div>

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
              </div>

              <div className="mt-auto border-t border-white/10 pt-2 pb-1 flex flex-col gap-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-400 hover:bg-red-400/10 hover:text-red-300 h-9 text-xs cursor-pointer"
                  onClick={() => {
                    setSidebarOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="mr-2 size-3.5" />
                  Log out
                </Button>
                <div className="py-0.5 text-center text-[10px] text-white/20 select-none">
                  Developer •{" "}
                  <a
                    href="https://discord.gg/z6ger9yRs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/25 hover:text-white/50 transition-colors"
                  >
                    Shree.
                  </a>
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
