"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  ExternalLink,
  Headphones,
  Loader2,
  Radio,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { JoinRoomRequestModal } from "@/components/join-room-request-modal";
import { useAuth } from "@/context/auth-context";
import { useListenTogether } from "@/context/listen-together-context";
import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { getSupabase } from "@/lib/supabase";
import type { PublicProfile, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  isOnline: boolean;
  isPlaying?: boolean;
  currentTrack?: Track;
  roomId: string;
  listenTogetherEnabled?: boolean;
  privacy?: "public" | "friends";
}

interface PendingRequest {
  id: string;
  fromUsername: string;
  fromDisplayName?: string;
  fromAvatar?: string;
  toUsername: string;
  toDisplayName?: string;
  toAvatar?: string;
  createdAt: number;
}

interface SearchUserResult {
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  isOnline: boolean;
  friendStatus: "friends" | "pending_sent" | "pending_received" | "none";
  requestId?: string;
}

type MainTab = "friends" | "pending";
type PendingSubTab = "received" | "sent";

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function ExploreDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { activeHostUsername, isListener } = useListenTogether();

  const [activeTab, setActiveTab] = useState<MainTab>("friends");
  const [pendingSubTab, setPendingSubTab] = useState<PendingSubTab>("received");

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{
    received: PendingRequest[];
    sent: PendingRequest[];
  }>({ received: [], sent: [] });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const searchSeqRef = useRef(0);

  // Selected host for Join Room Modal
  const [selectedHostProfile, setSelectedHostProfile] = useState<PublicProfile | null>(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Fetch friends and pending data from API
  const fetchFriendsData = useCallback(async (isInitial = false) => {
    if (!user?.username) return;
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(`/api/friends?username=${encodeURIComponent(user.username)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setFriends(Array.isArray(data.friends) ? data.friends : []);
          setPendingRequests(
            data.pending || { received: [], sent: [] }
          );
        }
      }
    } catch (err) {
      console.warn("Failed to fetch friends data:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user?.username]);

  // Load once on dialog open + Supabase Realtime subscription (no 4-second polling loop)
  useEffect(() => {
    if (!open || !user?.username) return;

    fetchFriendsData(true);

    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`friends-dialog-${user.username}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `to_username=eq.${user.username.toLowerCase()}`,
        },
        () => {
          fetchFriendsData(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          fetchFriendsData(false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, user?.username, fetchFriendsData]);

  // Search API effect with AbortController and race-condition prevention
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !user?.username) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const currentSeq = ++searchSeqRef.current;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/friends?search=${encodeURIComponent(q)}&current=${encodeURIComponent(user.username)}`,
          { signal: controller.signal }
        );
        if (res.ok && currentSeq === searchSeqRef.current) {
          const data = await res.json();
          if (data.success && Array.isArray(data.users)) {
            setSearchResults(data.users);
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.warn("Failed to search users:", err);
        }
      } finally {
        if (currentSeq === searchSeqRef.current) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery, user?.username]);

  // Handle Respond to friend request (accept or decline)
  const handleRespondRequest = async (requestId: string, responseAction: "accept" | "decline") => {
    setActionLoadingId(requestId);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          requestId,
          response: responseAction,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          responseAction === "accept"
            ? "Friend request accepted! You are now friends."
            : "Friend request declined."
        );
        await fetchFriendsData(false);
      } else {
        toast.error("Could not process request.");
      }
    } catch {
      toast.error("Failed to respond to request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Cancel sent request
  const handleCancelRequest = async (requestId: string) => {
    setActionLoadingId(requestId);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          requestId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Friend request cancelled.");
        await fetchFriendsData(false);
      } else {
        toast.error("Could not cancel request.");
      }
    } catch {
      toast.error("Failed to cancel request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Remove Friendship
  const handleRemoveFriend = async (friendUsername: string) => {
    if (!user) return;
    const confirmed = window.confirm(`Remove @${friendUsername} from your friends?`);
    if (!confirmed) return;

    setActionLoadingId(friendUsername);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          user1: user.username,
          user2: friendUsername,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Removed @${friendUsername} from friends`);
        await fetchFriendsData(false);
      } else {
        toast.error(data.error || "Failed to remove friend");
      }
    } catch {
      toast.error("Failed to remove friend");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Send Friend Request (from search list)
  const handleSendRequest = async (targetUsername: string) => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    setActionLoadingId(targetUsername);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          fromUsername: user.username,
          fromDisplayName: user.displayName,
          fromAvatar: user.avatar,
          toUsername: targetUsername,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Friend request sent to @${targetUsername}`);
        // update search result state locally
        setSearchResults((prev) =>
          prev.map((u) =>
            u.username.toLowerCase() === targetUsername.toLowerCase()
              ? { ...u, friendStatus: "pending_sent" }
              : u
          )
        );
        await fetchFriendsData(false);
      } else {
        toast.error(data.error || "Failed to send friend request.");
      }
    } catch {
      toast.error("Failed to send friend request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Join Room / Listen Together click handler
  const handleJoinClick = (friend: FriendUser) => {
    const profile: PublicProfile = {
      id: friend.id,
      username: friend.username,
      displayName: friend.displayName,
      avatar: friend.avatar,
      bio: friend.bio || "",
      background: DEFAULT_BACKGROUND,
      starCount: 0,
      isStarred: false,
      playlists: [],
    };
    setSelectedHostProfile(profile);
    setJoinModalOpen(true);
  };

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.username.toLowerCase().includes(q) ||
        f.displayName.toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  const receivedCount = pendingRequests.received.length;
  const sentCount = pendingRequests.sent.length;
  const totalPendingCount = receivedCount + sentCount;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="glass-window !border-white/20 !bg-[#0a0a10]/85 !text-white backdrop-blur-2xl max-w-[calc(100%-1.5rem)] sm:max-w-[560px] max-h-[90dvh] flex flex-col rounded-2xl shadow-2xl p-4 sm:p-6 overflow-hidden"
        >
          {/* Header with Title, Description, and Close 'X' Button */}
          <div className="relative shrink-0">
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
                Friends
              </DialogTitle>
              <DialogDescription className="text-white/60 text-[13px] font-normal leading-normal">
                Connect with friends, check online status, and listen to music together.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Primary Tabs: Friends and Pending */}
          <div className="mt-3.5 flex border-b border-white/10 gap-1 pb-1 overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("friends")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                activeTab === "friends"
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <Users className="size-3.5" />
              Friends ({friends.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer relative",
                activeTab === "pending"
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <Clock className="size-3.5" />
              Pending
              {receivedCount > 0 && (
                <span
                  className={cn(
                    "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    activeTab === "pending"
                      ? "bg-black text-white"
                      : "bg-emerald-500 text-black"
                  )}
                >
                  {receivedCount}
                </span>
              )}
            </button>
          </div>

          {/* Sub-tabs for Pending: Received & Sent */}
          {activeTab === "pending" && (
            <div className="mt-2.5 flex gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setPendingSubTab("received")}
                className={cn(
                  "flex-1 py-1 px-3 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
                  pendingSubTab === "received"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                <span>Received</span>
                <span className="text-[10px] opacity-70">({receivedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingSubTab("sent")}
                className={cn(
                  "flex-1 py-1 px-3 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
                  pendingSubTab === "sent"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                <span>Sent</span>
                <span className="text-[10px] opacity-70">({sentCount})</span>
              </button>
            </div>
          )}

          {/* Search Bar - Icon placed on the far right corner as requested */}
          <div className="mt-3 relative shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "friends"
                  ? "Search friends or find new people..."
                  : "Filter requests by username..."
              }
              className="w-full h-9 pl-3.5 pr-9 rounded-xl border border-white/15 bg-white/5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 transition-colors"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40 pointer-events-none" />
            )}
          </div>

          {/* Body Content Area */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1 slim-transparent-scrollbar min-h-[240px] max-h-[46vh]">
            {/* TAB 1: FRIENDS */}
            {activeTab === "friends" && (
              <>
                {/* When user is searching globally */}
                {searchQuery.trim() ? (
                  searching ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center text-white/40">
                      <Loader2 className="size-6 animate-spin text-white/60 mb-2" />
                      <p className="text-xs">Searching users...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 rounded-xl border border-white/15 bg-white/5 p-6">
                      <Search className="size-7 stroke-[1.5] text-white/30 mb-2" />
                      <p className="text-xs font-semibold text-white/80">
                        No users matching &quot;{searchQuery}&quot;
                      </p>
                      <p className="text-[11px] text-white/40 mt-1">
                        Try searching by an exact username or display name.
                      </p>
                    </div>
                  ) : (
                    searchResults.map((su) => {
                      const isMe = user?.username.toLowerCase() === su.username.toLowerCase();
                      const isLoadingThis = actionLoadingId === su.username;

                      return (
                        <div
                          key={su.username}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Pfp */}
                            <div className="relative shrink-0">
                              <div className="size-10 rounded-full overflow-hidden border border-white/20 bg-neutral-900 shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={su.avatar}
                                  alt={su.displayName}
                                  className="size-full object-cover"
                                />
                              </div>
                              {su.isOnline && (
                                <div
                                  title="Online"
                                  className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-[#0a0a10]"
                                />
                              )}
                            </div>

                            {/* Details */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  href={`/u/${encodeURIComponent(su.username)}`}
                                  onClick={() => onOpenChange(false)}
                                  className="font-semibold text-xs text-white hover:underline transition-colors truncate max-w-[170px]"
                                >
                                  {su.displayName}
                                </Link>
                                <span className="text-[11px] text-white/40 font-mono">
                                  @{su.username}
                                </span>
                                {isMe && (
                                  <span className="text-[9px] font-bold uppercase bg-white/15 text-white px-1.5 py-0.5 rounded">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-white/40 mt-0.5">
                                {su.isOnline ? (
                                  <span className="text-emerald-400">Online</span>
                                ) : (
                                  "Offline"
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Action */}
                          {!isMe && (
                            <div className="shrink-0">
                              {su.friendStatus === "friends" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                                  <Check className="size-3" /> Friends
                                </span>
                              ) : su.friendStatus === "pending_sent" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-white/60 border border-white/15 bg-white/5 px-2.5 py-1 rounded-lg">
                                  <Clock className="size-3 text-amber-400" /> Requested
                                </span>
                              ) : su.friendStatus === "pending_received" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (su.requestId) {
                                      handleRespondRequest(su.requestId, "accept");
                                    } else {
                                      handleSendRequest(su.username);
                                    }
                                  }}
                                  className="h-8 px-3 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 transition-colors cursor-pointer"
                                >
                                  Accept
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isLoadingThis}
                                  onClick={() => handleSendRequest(su.username)}
                                  className="h-8 px-3 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 border border-white/20 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <UserPlus className="size-3.5" />
                                  <span>Add Friend</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                ) : loading && friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center text-white/40">
                    <Loader2 className="size-6 animate-spin text-white/60 mb-2" />
                    <p className="text-xs">Loading friends...</p>
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 rounded-xl border border-white/15 bg-white/5 p-6">
                    <Users className="size-8 stroke-[1.5] text-white/30 mb-2" />
                    <p className="text-xs font-semibold text-white/80">No friends added yet</p>
                    <p className="text-[11px] text-white/40 mt-1 max-w-xs">
                      Search for users by username or display name above to send them a friend request!
                    </p>
                  </div>
                ) : (
                  filteredFriends.map((friend) => {
                    const isCurrentlyListening =
                      isListener &&
                      activeHostUsername?.toLowerCase() === friend.username.toLowerCase();

                    return (
                      <div
                        key={friend.username}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-all"
                      >
                        {/* User info: pfp, display name, username, online/offline */}
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Avatar with online dot */}
                          <div className="relative shrink-0 mt-0.5">
                            <div className="size-10 rounded-full overflow-hidden border border-white/20 bg-neutral-900 shadow-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={friend.avatar}
                                alt={friend.displayName}
                                className="size-full object-cover"
                              />
                            </div>
                            <div
                              title={friend.isOnline ? "Online" : "Offline"}
                              className={cn(
                                "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0a0a10]",
                                friend.isOnline ? "bg-emerald-400" : "bg-neutral-600"
                              )}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                href={`/u/${encodeURIComponent(friend.username)}`}
                                onClick={() => onOpenChange(false)}
                                className="font-semibold text-xs text-white hover:underline transition-colors truncate max-w-[170px]"
                              >
                                {friend.displayName}
                              </Link>
                              <span className="text-[11px] text-white/40 font-mono">
                                @{friend.username}
                              </span>
                            </div>

                            {/* Online or not & playback */}
                            {friend.isOnline ? (
                              friend.isPlaying && friend.currentTrack ? (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-400 truncate max-w-[260px]">
                                  <span className="flex items-end gap-0.5 h-2.5 px-0.5 shrink-0">
                                    <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s] h-full" />
                                    <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s] h-1.5" />
                                    <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-2" />
                                  </span>
                                  <span className="truncate">
                                    {friend.currentTrack.title}
                                  </span>
                                </div>
                              ) : (
                                <p className="mt-0.5 text-[10px] text-emerald-400 font-medium">
                                  Online
                                </p>
                              )
                            ) : (
                              <p className="mt-0.5 text-[10px] text-white/40">Offline</p>
                            )}
                          </div>
                        </div>

                        {/* Actions: Profile Link and Listen Together button */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Link
                            href={`/u/${encodeURIComponent(friend.username)}`}
                            onClick={() => onOpenChange(false)}
                            className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 transition-colors flex items-center gap-1 cursor-pointer"
                            title="View Profile & Room"
                          >
                            <ExternalLink className="size-3" />
                            <span>Profile</span>
                          </Link>

                          {isCurrentlyListening ? (
                            <span className="h-8 px-3 rounded-lg text-xs font-semibold bg-white/10 text-white border border-white/20 flex items-center gap-1.5">
                              <Headphones className="size-3.5" />
                              Listening
                            </span>
                          ) : friend.listenTogetherEnabled !== false ? (
                            <button
                              type="button"
                              onClick={() => handleJoinClick(friend)}
                              className="h-8 px-3 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Radio className="size-3.5" />
                              <span>Listen Together</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-white/30 px-2">
                              Private
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveFriend(friend.username)}
                            className="size-8 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-white/10 transition-colors flex items-center justify-center cursor-pointer"
                            title={`Remove @${friend.username} from friends`}
                          >
                            <UserMinus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* TAB 2: PENDING (Received and Sent) */}
            {activeTab === "pending" && (
              <>
                {pendingSubTab === "received" ? (
                  pendingRequests.received.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 rounded-xl border border-white/15 bg-white/5 p-6">
                      <UserCheck className="size-8 stroke-[1.5] text-white/30 mb-2" />
                      <p className="text-xs font-semibold text-white/80">No received requests</p>
                      <p className="text-[11px] text-white/40 mt-1 max-w-xs">
                        When someone sends you a friend request, it will appear here.
                      </p>
                    </div>
                  ) : (
                    pendingRequests.received.map((req) => {
                      const isLoading = actionLoadingId === req.id;
                      return (
                        <div
                          key={req.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-10 rounded-full overflow-hidden border border-white/20 bg-neutral-900 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={
                                  req.fromAvatar ||
                                  `https://api.dicebear.com/7.x/shapes/svg?seed=${req.fromUsername}`
                                }
                                alt={req.fromDisplayName || req.fromUsername}
                                className="size-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  href={`/u/${encodeURIComponent(req.fromUsername)}`}
                                  onClick={() => onOpenChange(false)}
                                  className="font-semibold text-xs text-white hover:underline truncate max-w-[160px]"
                                >
                                  {req.fromDisplayName || req.fromUsername}
                                </Link>
                                <span className="text-[11px] text-white/40 font-mono">
                                  @{req.fromUsername}
                                </span>
                              </div>
                              <span className="text-[10px] text-white/40 mt-0.5 block">
                                {formatRelativeTime(req.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Accept / Decline actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleRespondRequest(req.id, "accept")}
                              className="h-8 px-3 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="size-3.5" />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleRespondRequest(req.id, "decline")}
                              className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <X className="size-3.5" />
                              <span>Decline</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  // Sent requests
                  pendingRequests.sent.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 rounded-xl border border-white/15 bg-white/5 p-6">
                      <Clock className="size-8 stroke-[1.5] text-white/30 mb-2" />
                      <p className="text-xs font-semibold text-white/80">No sent requests</p>
                      <p className="text-[11px] text-white/40 mt-1 max-w-xs">
                        You have no outgoing friend requests waiting for approval.
                      </p>
                    </div>
                  ) : (
                    pendingRequests.sent.map((req) => {
                      const isLoading = actionLoadingId === req.id;
                      return (
                        <div
                          key={req.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-10 rounded-full overflow-hidden border border-white/20 bg-neutral-900 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={
                                  req.toAvatar ||
                                  `https://api.dicebear.com/7.x/shapes/svg?seed=${req.toUsername}`
                                }
                                alt={req.toDisplayName || req.toUsername}
                                className="size-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  href={`/u/${encodeURIComponent(req.toUsername)}`}
                                  onClick={() => onOpenChange(false)}
                                  className="font-semibold text-xs text-white hover:underline truncate max-w-[160px]"
                                >
                                  {req.toDisplayName || req.toUsername}
                                </Link>
                                <span className="text-[11px] text-white/40 font-mono">
                                  @{req.toUsername}
                                </span>
                              </div>
                              <span className="text-[10px] text-amber-300/80 mt-0.5 block">
                                Request pending approval • {formatRelativeTime(req.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Cancel button */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleCancelRequest(req.id)}
                            className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            <span>Cancel</span>
                          </button>
                        </div>
                      );
                    })
                  )
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 mt-4 pt-3 flex items-center justify-between shrink-0">
            <span className="text-xs text-white/40">
              {activeTab === "friends"
                ? `${friends.length} ${friends.length === 1 ? "friend" : "friends"}`
                : `${totalPendingCount} pending`}
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl bg-white text-black hover:bg-white/90 font-semibold text-sm px-6 h-9 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Room Request Modal */}
      {selectedHostProfile && (
        <JoinRoomRequestModal
          open={joinModalOpen}
          onOpenChange={setJoinModalOpen}
          hostProfile={selectedHostProfile}
        />
      )}
    </>
  );
}
