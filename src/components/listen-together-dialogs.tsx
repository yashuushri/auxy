"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  LogOut,
  UserMinus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useListenTogether } from "@/context/listen-together-context";
import type { RoomParticipant } from "@/lib/types";

// 1. Host: Pending Join Requests Dialog
export function JoinRequestsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { pendingRequests, acceptRequest, declineRequest } = useListenTogether();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass-window !border-white/15 !bg-[#0b0c14]/95 !text-white backdrop-blur-2xl sm:max-w-[440px] rounded-2xl shadow-2xl p-5 slim-transparent-scrollbar"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="absolute -top-1 -right-1 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="size-4.5 stroke-[2]" />
          </button>

          <DialogHeader className="text-left gap-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="size-4 text-amber-400" />
              <span>Join Requests</span>
              {pendingRequests.length > 0 && (
                <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.2 text-[11px] font-semibold">
                  {pendingRequests.length}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Users requesting to join your Listen Together playback.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="mt-4 space-y-2.5 max-h-[320px] overflow-y-auto pr-1 slim-transparent-scrollbar">
          {pendingRequests.length === 0 ? (
            <div className="py-8 text-center text-white/40 text-xs">
              No pending requests at the moment.
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-white/20 bg-neutral-900">
                    {req.avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={req.avatar}
                        alt={req.displayName}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center text-white/50 text-xs font-bold">
                        {req.displayName[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-tight">
                      {req.displayName}
                    </p>
                    <p className="text-[11px] text-white/50 truncate">
                      @{req.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => declineRequest(req.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => acceptRequest(req)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm transition-colors cursor-pointer"
                  >
                    <Check className="size-3.5 stroke-[2.5]" />
                    Accept
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 2. Host: Active Listeners in Room & Kick Dialog
export function ActiveListenersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { participants, kickUser, isHost, activeHostUsername, isListener } = useListenTogether();
  const [kickTarget, setKickTarget] = useState<RoomParticipant | null>(null);

  // Identify the room host
  const hostUsername = (isListener && activeHostUsername ? activeHostUsername : user?.username || "").toLowerCase();

  const hostParticipant = participants.find(
    (p) => p.username.toLowerCase() === hostUsername
  ) || (isHost && user ? {
    id: user.id || user.username,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar || "",
    joinedAt: 0,
    lastSeen: 0,
  } : null);

  // Only other listeners (excluding the host)
  const listeners = participants.filter(
    (p) => p.username.toLowerCase() !== hostUsername
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="glass-window !border-white/15 !bg-[#0b0c14]/95 !text-white backdrop-blur-2xl sm:max-w-[420px] rounded-2xl shadow-2xl p-5 slim-transparent-scrollbar"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="absolute -top-1 -right-1 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="size-4.5 stroke-[2]" />
            </button>

            <DialogHeader className="text-left gap-1">
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <span>Listeners in Room</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">
                  {listeners.length}
                </span>
              </DialogTitle>
              <DialogDescription className="text-white/50 text-xs">
                All listeners currently tuned into this room playback.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1 slim-transparent-scrollbar">
            {/* Host entry with Crown (no blue icon, no "HOST" text) */}
            {hostParticipant && (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="relative size-9 shrink-0">
                    {/* Host avatar */}
                    {hostParticipant.avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={hostParticipant.avatar}
                        alt={hostParticipant.displayName}
                        className="size-full rounded-full object-cover border border-amber-400/40 bg-neutral-900 shadow-sm"
                      />
                    ) : (
                      <div className="size-full rounded-full flex items-center justify-center bg-neutral-900 border border-amber-400/40 text-amber-200 text-xs font-bold">
                        {hostParticipant.displayName[0]}
                      </div>
                    )}
                    {/* Crown on top of Host Avatar */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.emojiterra.com/microsoft/fluent-emoji/15.1/512px/1f451_color.png"
                      alt="Crown"
                      className="absolute -top-2.5 -right-1.5 size-5 select-none drop-shadow pointer-events-none transform rotate-12"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white block leading-tight">
                      {hostParticipant.displayName}
                    </span>
                    <span className="text-[10px] text-amber-300/80 block">
                      @{hostParticipant.username}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Other listeners */}
            {listeners.length === 0 ? (
              <div className="py-6 text-center text-xs text-white/40">
                No active listeners in the room right now.
              </div>
            ) : (
              listeners.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-neutral-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatar}
                        alt={p.displayName}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate leading-tight">
                        {p.displayName}
                      </p>
                      <p className="text-[10px] text-white/50 truncate">
                        @{p.username}
                      </p>
                    </div>
                  </div>

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => setKickTarget(p)}
                      title={`Kick @${p.username}`}
                      className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <UserMinus className="size-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Kick Confirmation Modal */}
      {kickTarget && (
        <Dialog open={Boolean(kickTarget)} onOpenChange={() => setKickTarget(null)}>
          <DialogContent
            showCloseButton={false}
            className="glass-window !border-white/15 !bg-[#0b0c14]/95 !text-white backdrop-blur-2xl sm:max-w-[360px] rounded-2xl p-5 shadow-2xl"
          >
            <DialogHeader className="text-left gap-1">
              <DialogTitle className="text-sm font-bold text-white">
                Kick listener?
              </DialogTitle>
              <DialogDescription className="text-xs text-white/60">
                Are you sure you want to kick <strong className="text-white">@{kickTarget.username}</strong> from Listen Together?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex flex-row gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
                onClick={() => setKickTarget(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                onClick={() => {
                  kickUser(kickTarget.id);
                  setKickTarget(null);
                }}
              >
                Kick Listener
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// 3. Listener: Leave Room Confirmation Dialog
export function LeaveRoomDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeHostUsername, leaveListenTogether } = useListenTogether();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass-window !border-white/15 !bg-[#0b0c14]/95 !text-white backdrop-blur-2xl sm:max-w-[380px] rounded-2xl p-5 shadow-2xl"
      >
        <DialogHeader className="text-left gap-1.5">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <LogOut className="size-4 text-red-400" />
            <span>Leave Listen Together?</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-white/60 leading-relaxed">
            You are currently listening with <strong className="text-white">@{activeHostUsername}</strong>. Leaving will return you to your own solo room.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-row gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            Stay
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
            onClick={() => {
              onOpenChange(false);
              leaveListenTogether();
            }}
          >
            Leave Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
