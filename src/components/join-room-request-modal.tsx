"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useListenTogether } from "@/context/listen-together-context";
import { subscribeToSingleRequestInSupabase } from "@/lib/supabase-db";
import type { PublicProfile } from "@/lib/types";

export function JoinRoomRequestModal({
  open,
  onOpenChange,
  hostProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostProfile: PublicProfile;
}) {
  const router = useRouter();
  const { requestToJoinRoom, cancelMyRequest, joinAsListener } = useListenTogether();

  const [requestState, setRequestState] = useState<
    "idle" | "requesting" | "pending" | "accepted" | "declined" | "disabled" | "error"
  >("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRequestState("idle");
      setRequestId(null);
      setRoomId(null);
      return;
    }

    let isMounted = true;
    setRequestState("requesting");

    requestToJoinRoom(hostProfile.username).then((res) => {
      if (!isMounted) return;
      setRoomId(res.roomId);

      if (res.status === "auto_accepted") {
        setRequestState("accepted");
        joinAsListener(hostProfile.username);
        setTimeout(() => {
          onOpenChange(false);
          router.push("/");
        }, 800);
      } else if (res.status === "pending" && res.requestId) {
        setRequestId(res.requestId);
        setRequestState("pending");
      } else if (res.status === "disabled") {
        setRequestState("disabled");
      } else {
        setRequestState("error");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [open, hostProfile.username, requestToJoinRoom, joinAsListener, router, onOpenChange]);

  // Subscribe to real-time status update from Host
  useEffect(() => {
    if (!roomId || !requestId || requestState !== "pending") return;

    const unsubscribe = subscribeToSingleRequestInSupabase(requestId, (req) => {
      if (!req) return;
      if (req.status === "accepted") {
        setRequestState("accepted");
        joinAsListener(hostProfile.username);
        setTimeout(() => {
          onOpenChange(false);
          router.push("/");
        }, 800);
      } else if (req.status === "declined") {
        setRequestState("declined");
      }
    });

    return () => unsubscribe();
  }, [roomId, requestId, requestState, hostProfile.username, joinAsListener, router, onOpenChange]);

  const handleCancel = async () => {
    if (roomId && requestId) {
      await cancelMyRequest(roomId, requestId);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass-window !border-white/15 !bg-[#0b0c14]/95 !text-white backdrop-blur-2xl sm:max-w-[380px] rounded-2xl p-6 shadow-2xl text-center"
      >
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close"
            className="absolute -top-2 -right-2 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="size-4.5 stroke-[2]" />
          </button>

          {/* Host Avatar */}
          <div className="relative mt-2 mb-4">
            <div className="size-16 rounded-full overflow-hidden border border-white/20 bg-neutral-900 shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hostProfile.avatar}
                alt={hostProfile.displayName}
                className="size-full object-cover"
              />
            </div>
          </div>

          <DialogHeader className="text-center gap-1.5 w-full">
            <DialogTitle className="text-base font-semibold text-white">
              {requestState === "accepted"
                ? "Joined Room"
                : requestState === "declined"
                ? "Request Declined"
                : requestState === "disabled"
                ? "Listen Together Disabled"
                : "Request pending approval"}
            </DialogTitle>

            <DialogDescription className="text-xs text-white/50 leading-relaxed max-w-xs mx-auto">
              {requestState === "requesting" && "Connecting to room..."}
              {requestState === "pending" &&
                `Waiting for @${hostProfile.username} to accept your request`}
              {requestState === "accepted" &&
                "Syncing playback and entering room..."}
              {requestState === "declined" &&
                `@${hostProfile.username} is unable to accept right now.`}
              {requestState === "disabled" &&
                `@${hostProfile.username} has disabled Listen Together.`}
              {requestState === "error" &&
                "Unable to connect to room. Please try again."}
            </DialogDescription>
          </DialogHeader>

          {/* Status visual states */}
          <div className="mt-4 w-full">
            {requestState === "pending" && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Loader2 className="size-3.5 animate-spin text-white/50" />
                  <span>Waiting for host response</span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 w-full border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
                  onClick={handleCancel}
                >
                  Cancel Request
                </Button>
              </div>
            )}

            {requestState === "accepted" && (
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                <Check className="size-4 stroke-[3]" />
                <span>Joined Room</span>
              </div>
            )}

            {(requestState === "declined" ||
              requestState === "disabled" ||
              requestState === "error") && (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
