"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { LogOut, Settings2, UserRound } from "lucide-react";
import { EditPanel } from "@/components/edit-panel";
import { FloatingWindow } from "@/components/floating-window";
import { RoomBackground } from "@/components/room-background";
import { SettingsDialog } from "@/components/settings-dialog";
import { SpotifyWindow } from "@/components/spotify-window";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { isLightBackground } from "@/lib/contrast";
import { usernameKey } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  EDIT_WINDOW_WIDTH,
  PLAYER_WINDOW_WIDTH,
  WINDOW_TOP_MIN,
  centeredPairLayout,
} from "@/lib/window-layout";

export function DesktopHome() {
  const { user, logout } = useAuth();
  const [roomOpen, setRoomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<boolean | null>(null);
  const [pair, setPair] = useState<ReturnType<typeof centeredPairLayout> | null>(null);

  useEffect(() => {
    if (!user) return;
    const key = `mp_win_edit_open_v2_${usernameKey(user.username)}`;
    setEditOpen(localStorage.getItem(key) !== "0");
    setPair(centeredPairLayout(window.innerWidth, window.innerHeight));
  }, [user]);

  function toggleEdit() {
    if (!user) return;
    setEditOpen((open) => {
      const next = !open;
      localStorage.setItem(`mp_win_edit_open_v2_${usernameKey(user.username)}`, next ? "1" : "0");
      return next;
    });
  }

  if (!user) return null;

  const lightRoom = isLightBackground(user.background);
  const overlayBtn = lightRoom
    ? "border-black/20 bg-white/80 text-neutral-950 hover:bg-white hover:text-neutral-950"
    : "border-white/25 bg-black/40 text-white hover:bg-black/55 hover:text-white";

  return (
    <div className="page-in relative min-h-svh overflow-hidden bg-black">
      <RoomBackground user={user} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-start justify-between px-4 py-3 sm:px-6">
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
        <div className="pointer-events-auto flex items-center gap-2">
          <a
            href={`/u/${user.username}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
              overlayBtn
            )}
            title="Public profile"
          >
            <UserRound className="size-3.5" />
            @{user.username}
          </a>
          <Button
            size="icon-sm"
            variant="outline"
            className={overlayBtn}
            title="Edit profile"
            aria-label="Edit profile"
            onClick={toggleEdit}
          >
            <Settings2 />
          </Button>
          <Button size="sm" variant="outline" className={overlayBtn} onClick={() => setRoomOpen(true)}>
            Room
          </Button>
          <Button size="sm" variant="outline" className={overlayBtn} onClick={logout}>
            <LogOut data-icon="inline-start" />
            Log out
          </Button>
        </div>
      </div>

      {pair && editOpen !== null ? (
        <>
          <FloatingWindow
            title="Edit"
            open={editOpen}
            onClose={() => {
              setEditOpen(false);
              localStorage.setItem(`mp_win_edit_open_v2_${usernameKey(user.username)}`, "0");
            }}
            persistKey={`mp_win_edit_v2_${usernameKey(user.username)}`}
            defaultX={pair.editX}
            defaultY={pair.y}
            defaultWidth={EDIT_WINDOW_WIDTH}
            defaultHeight={pair.playerHeight}
            widthClassName="w-[320px]"
            minHeight={280}
            maxTop={WINDOW_TOP_MIN}
          >
            <EditPanel />
          </FloatingWindow>

          <FloatingWindow
            title="Player"
            persistKey={`mp_win_player_v2_${usernameKey(user.username)}`}
            defaultX={pair.playerX}
            defaultY={pair.y}
            resizable
            defaultWidth={PLAYER_WINDOW_WIDTH}
            defaultHeight={pair.playerHeight}
            minHeight={258}
            maxTop={WINDOW_TOP_MIN}
          >
            <SpotifyWindow />
          </FloatingWindow>
        </>
      ) : null}

      <SettingsDialog open={roomOpen} onOpenChange={setRoomOpen} />
    </div>
  );
}
