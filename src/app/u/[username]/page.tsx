"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Play, Pause, Music2, Share2, ArrowLeft, MoreHorizontal, Flag, ShieldBan, Settings, Edit3, UserPlus, UserMinus, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoomBackground } from "@/components/room-background";
import { useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { fetchPublicProfileFromSupabase } from "@/lib/supabase-db";
import { getUser } from "@/lib/storage";
import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import type { PublicProfile, Background, UserAccount, Track } from "@/lib/types";

function convertUserToPublicProfile(u: UserAccount): PublicProfile {
  const libraryMap = new Map<string, Track>();
  (u.library || []).forEach((t) => {
    if (t.id) libraryMap.set(t.id, t);
  });

  const publicPlaylists = (u.playlists || [])
    .filter((p) => p.isPublic !== false)
    .map((p) => {
      const tracks = (p.trackIds || [])
        .map((tid) => libraryMap.get(tid))
        .filter((t): t is Track => !!t);

      return {
        id: p.id,
        name: p.name,
        description: p.description || "",
        cover: p.cover || tracks[0]?.cover,
        trackCount: tracks.length,
        tracks,
      };
    });

  return {
    id: u.id || u.username,
    username: u.username,
    displayName: u.displayName || u.username,
    pronouns: u.pronouns || "",
    avatar: u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`,
    bio: u.bio || "",
    background: u.background || DEFAULT_BACKGROUND,
    starCount: 0,
    isStarred: false,
    playlists: publicPlaylists,
  };
}

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const cleanUsername = (username || "").trim().toLowerCase();
  const { user } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlay, addTracks, setActivePlaylist } = usePlayer();

  const isOwner = !!user && user.username.toLowerCase() === cleanUsername;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<"none" | "friends" | "pending_sent" | "pending_received">("none");
  const [friendLoading, setFriendLoading] = useState(false);

  // Real-time synchronization when owner edits their pfp, bio, or background in their room
  useEffect(() => {
    if (isOwner && user) {
      const live = convertUserToPublicProfile(user);
      setProfile(live);
      if (live.playlists.length > 0 && !selectedPlaylistId) {
        setSelectedPlaylistId(live.playlists[0].id);
      }
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, user?.username]);

  // Initial load & remote synchronization
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cleanUsername) return;

      // 1. Instant local cache lookup
      if (isOwner && user) {
        const liveProfile = convertUserToPublicProfile(user);
        if (!cancelled) {
          setProfile(liveProfile);
          if (liveProfile.playlists.length > 0 && !selectedPlaylistId) {
            setSelectedPlaylistId(liveProfile.playlists[0].id);
          }
          setLoading(false);
        }
      } else {
        const localUser = getUser(cleanUsername);
        if (localUser && !cancelled) {
          const cachedProfile = convertUserToPublicProfile(localUser);
          setProfile(cachedProfile);
          if (cachedProfile.playlists.length > 0 && !selectedPlaylistId) {
            setSelectedPlaylistId(cachedProfile.playlists[0].id);
          }
          setLoading(false);
        }
      }

      // 2. Fetch from Supabase PostgreSQL for cloud sync (playlists, bio)
      try {
        const remoteProfile = await fetchPublicProfileFromSupabase(cleanUsername);
        if (remoteProfile && !cancelled) {
          setProfile((current) => {
            if (!current) return remoteProfile;
            return {
              ...remoteProfile,
              // If local/live state has custom edits, prefer them
              displayName: current.displayName || remoteProfile.displayName,
              avatar: current.avatar || remoteProfile.avatar,
              bio: current.bio !== undefined && current.bio !== "" ? current.bio : remoteProfile.bio,
              background: current.background || remoteProfile.background,
            };
          });
          if (remoteProfile.playlists?.length > 0 && !selectedPlaylistId) {
            setSelectedPlaylistId(remoteProfile.playlists[0].id);
          }
        }
      } catch (err) {
        console.warn("Supabase profile fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanUsername, isOwner, user?.username]);

  // Check friendship status
  useEffect(() => {
    if (!user || isOwner || !cleanUsername) return;
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/friends?username=${encodeURIComponent(user!.username)}&target=${encodeURIComponent(cleanUsername)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.success && data.status) {
            setFriendStatus(data.status);
          }
        }
      } catch (err) {
        console.error("Failed to load friend status:", err);
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [user, isOwner, cleanUsername]);

  function copyProfileUrl() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Profile link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleAddFriend() {
    if (!user) {
      toast.error("Please sign in to add friends");
      return;
    }
    if (!profile) return;
    setFriendLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          fromUsername: user.username,
          fromDisplayName: user.displayName,
          fromAvatar: user.avatar,
          toUsername: profile.username,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFriendStatus("pending_sent");
        toast.success(`Friend request sent to @${profile.username}`);
      } else {
        toast.error(data.error || "Failed to send friend request");
      }
    } catch {
      toast.error("Failed to send friend request");
    } finally {
      setFriendLoading(false);
    }
  }

  async function handleCancelRequest() {
    if (!user || !profile) return;
    setFriendLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          fromUsername: user.username,
          toUsername: profile.username,
        }),
      });
      if (res.ok) {
        setFriendStatus("none");
        toast.success("Friend request cancelled");
      }
    } catch {
      toast.error("Failed to cancel friend request");
    } finally {
      setFriendLoading(false);
    }
  }

  async function handleAcceptRequest() {
    if (!user || !profile) return;
    setFriendLoading(true);
    try {
      // Find the request or request mutually
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          fromUsername: user.username,
          toUsername: profile.username,
        }),
      });
      if (res.ok) {
        setFriendStatus("friends");
        toast.success(`You and @${profile.username} are now friends!`);
      }
    } catch {
      toast.error("Failed to accept friend request");
    } finally {
      setFriendLoading(false);
    }
  }

  async function handleRemoveFriend() {
    if (!user || !profile) return;
    setFriendLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          user1: user.username,
          user2: profile.username,
        }),
      });
      if (res.ok) {
        setFriendStatus("none");
        toast.success(`Removed @${profile.username} from friends`);
      }
    } catch {
      toast.error("Failed to remove friend");
    } finally {
      setFriendLoading(false);
    }
  }

  function playPlaylist(playlist: PublicProfile["playlists"][0], startTrackIndex = 0) {
    if (!playlist.tracks || playlist.tracks.length === 0) {
      toast.message("This playlist is empty");
      return;
    }
    // Load tracks into player
    addTracks(playlist.tracks, playlist.id);
    setActivePlaylist(playlist.id);
    playTrack(startTrackIndex, playlist.id);
    toast.success(`Playing ${playlist.name}`);
  }

  const selectedPlaylist = profile?.playlists.find((p) => p.id === selectedPlaylistId) || profile?.playlists[0];

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#0a0a0f] text-white">
        <div className="flex flex-col items-center gap-3">
          <Music2 className="size-8 animate-pulse text-white/50" />
          <p className="text-sm text-neutral-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-[#0a0a0f] px-4 text-center text-white">
        <h1 className="text-2xl font-semibold">User not found</h1>
        <p className="mt-2 text-sm text-neutral-400">The profile @{username} doesn&apos;t exist or is private.</p>
        <Link href="/" className="mt-6">
          <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 size-4" />
            Back to Auxy
          </Button>
        </Link>
      </div>
    );
  }

  const effectiveBackground: Background =
    (isOwner && user?.background)
      ? user.background
      : (profile.background || DEFAULT_BACKGROUND);

  return (
    <div className="page-in relative min-h-svh text-white selection:bg-white/20">
      {/* Dynamic Room Background synced from user profile */}
      <RoomBackground background={effectiveBackground} />

      {/* Top minimal navigation bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-black/40 px-6 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-medium text-white/90 hover:text-white transition-colors">
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
          <span className="font-semibold tracking-wide">Auxy</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button size="sm" variant="outline" className="border-white/20 bg-black/50 text-xs text-white hover:bg-white/10 backdrop-blur-sm">
              My Room
            </Button>
          </Link>
        </div>
      </header>

      {/* Profile Header Card */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/50 p-6 backdrop-blur-xl sm:p-8 shadow-2xl shadow-black/60">
          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-white/20 shadow-2xl bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.avatar}
                alt={profile.displayName}
                className="size-full object-cover"
                loading="lazy"
              />
            </div>

            {/* User details */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div>
                  <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                    <h1 className="text-2xl font-bold tracking-tight text-white">{profile.displayName}</h1>
                    {profile.pronouns && (
                      <span className="text-sm text-neutral-400 font-normal">({profile.pronouns})</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400">@{profile.username}</p>
                </div>

                {/* Share action button */}
                <div className="mt-3 flex items-center justify-center sm:justify-end gap-2 sm:mt-0 flex-wrap">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={copyProfileUrl}
                    title="Copy Profile URL"
                    className="border-white/15 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white backdrop-blur-sm"
                  >
                    {copied ? <Check className="size-4 text-emerald-400" /> : <Share2 className="size-4" />}
                  </Button>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="mt-3 text-sm text-neutral-300 max-w-xl leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Quick stats badge */}
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-neutral-400">
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-white/80">
                  <Music2 className="size-3.5 text-white/50" />
                  {profile.playlists.length} {profile.playlists.length === 1 ? "Playlist" : "Playlists"}
                </span>
                {isOwner ? (
                  <div className="flex items-center gap-2">
                    <Link href="/">
                      <Button size="sm" variant="outline" className="h-7 rounded-full border-white/20 bg-white/5 px-3 text-xs hover:bg-white/15">
                        <Edit3 className="mr-1.5 size-3" />
                        Edit Profile
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex shrink-0 items-center justify-center text-sm font-medium transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 border-border aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input h-7 w-7 rounded-full border-white/20 bg-white/5 hover:bg-white/15">
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-black/90 backdrop-blur-xl border-white/10 text-neutral-200">
                        <DropdownMenuItem onClick={copyProfileUrl} className="hover:bg-white/10 hover:text-white cursor-pointer">
                          <Share2 className="mr-2 size-4" /> Share Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-white/10 hover:text-white cursor-pointer">
                          <Settings className="mr-2 size-4" /> Account Settings
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {friendStatus === "friends" ? (
                      <span className="inline-flex items-center gap-1.5 h-7 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-400">
                        <Check className="size-3" />
                        Friends
                      </span>
                    ) : friendStatus === "pending_sent" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={friendLoading}
                        onClick={handleCancelRequest}
                        title="Click to cancel request"
                        className="h-7 rounded-full border-white/20 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10"
                      >
                        <Clock className="mr-1.5 size-3 text-amber-400" />
                        Requested
                      </Button>
                    ) : friendStatus === "pending_received" ? (
                      <Button
                        size="sm"
                        disabled={friendLoading}
                        onClick={handleAcceptRequest}
                        className="h-7 rounded-full bg-white text-black hover:bg-white/90 px-3 text-xs font-medium cursor-pointer"
                      >
                        <UserCheck className="mr-1.5 size-3" />
                        Accept Friend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={friendLoading}
                        onClick={handleAddFriend}
                        className="h-7 rounded-full border-white/20 bg-white/5 px-3 text-xs text-white hover:bg-white/15 cursor-pointer"
                      >
                        <UserPlus className="mr-1.5 size-3" />
                        Add Friend
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex shrink-0 items-center justify-center text-sm font-medium transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 border-border aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input h-7 w-7 rounded-full border-white/20 bg-white/5 hover:bg-white/15">
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-black/90 backdrop-blur-xl border-white/10 text-neutral-200">
                        <DropdownMenuItem onClick={copyProfileUrl} className="hover:bg-white/10 hover:text-white cursor-pointer">
                          <Share2 className="mr-2 size-4" /> Share Profile
                        </DropdownMenuItem>
                        {friendStatus === "friends" && (
                          <>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                              onClick={handleRemoveFriend}
                              className="text-red-400 hover:bg-red-500/10 cursor-pointer"
                            >
                              <UserMinus className="mr-2 size-4" /> Remove Friend
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem className="hover:bg-red-500/20 hover:text-red-400 text-red-400 cursor-pointer">
                          <Flag className="mr-2 size-4" /> Report User
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-red-500/20 hover:text-red-400 text-red-400 cursor-pointer">
                          <ShieldBan className="mr-2 size-4" /> Block User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Playlists Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-lg font-semibold tracking-tight text-white drop-shadow-sm">Playlists</h2>
          </div>

          {profile.playlists.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-8 text-center text-neutral-400 backdrop-blur-md">
              <p className="text-sm">No playlists shared yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Playlists sidebar / selector */}
              <div className="flex flex-col gap-2 max-h-[385px] overflow-y-auto pr-1.5 slim-transparent-scrollbar">
                {profile.playlists.map((pl) => {
                  const isSelected = selectedPlaylist?.id === pl.id;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all backdrop-blur-md ${
                        isSelected
                          ? "border-white/30 bg-black/70 shadow-lg shadow-black/50"
                          : "border-white/10 bg-black/40 hover:border-white/20 hover:bg-black/55"
                      }`}
                    >
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-neutral-900 border border-white/10">
                        {pl.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pl.cover} alt={pl.name} className="size-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-white/30">
                            <Music2 className="size-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{pl.name}</p>
                        <p className="text-xs text-neutral-400">{pl.trackCount} {pl.trackCount === 1 ? "track" : "tracks"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Playlist Track List */}
              {selectedPlaylist && (
                <div className="col-span-1 md:col-span-2 flex flex-col rounded-2xl border border-white/15 bg-black/50 p-5 backdrop-blur-xl shadow-xl shadow-black/50">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{selectedPlaylist.name}</h3>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-neutral-300">
                          {selectedPlaylist.tracks.length} {selectedPlaylist.tracks.length === 1 ? "track" : "tracks"}
                        </span>
                      </div>
                      {selectedPlaylist.description && (
                        <p className="text-xs text-neutral-400 mt-0.5">{selectedPlaylist.description}</p>
                      )}
                    </div>
                    {selectedPlaylist.tracks.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => playPlaylist(selectedPlaylist, 0)}
                        className="bg-white text-neutral-950 hover:bg-neutral-200 shadow-md cursor-pointer"
                      >
                        <Play className="mr-1.5 size-3.5 fill-current" />
                        Play All
                      </Button>
                    )}
                  </div>

                  {/* Track rows (scrollable container showing exactly 7 items before scroll) */}
                  <div className="mt-3 flex flex-col divide-y divide-white/5 max-h-[385px] overflow-y-auto pr-1.5 slim-transparent-scrollbar">
                    {selectedPlaylist.tracks.length === 0 ? (
                      <p className="py-6 text-center text-xs text-neutral-500">No tracks in this playlist.</p>
                    ) : (
                      selectedPlaylist.tracks.map((track, idx) => {
                        const isThisPlaying = currentTrack?.youtubeId === track.youtubeId && isPlaying;
                        return (
                          <div
                            key={track.id || idx}
                            className="group flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/[0.08] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="w-5 text-center text-xs text-neutral-400">{idx + 1}</span>
                              <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-neutral-900 border border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={track.cover || `https://img.youtube.com/vi/${track.youtubeId}/hqdefault.jpg`}
                                  alt={track.title}
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isThisPlaying) togglePlay();
                                    else playPlaylist(selectedPlaylist, idx);
                                  }}
                                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {isThisPlaying ? (
                                    <Pause className="size-4 fill-white text-white" />
                                  ) : (
                                    <Play className="size-4 fill-white text-white" />
                                  )}
                                </button>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm ${isThisPlaying ? "text-amber-400 font-medium" : "text-white"}`}>
                                  {track.title}
                                </p>
                                <p className="truncate text-xs text-neutral-400">{track.artist}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (isThisPlaying) togglePlay();
                                else playPlaylist(selectedPlaylist, idx);
                              }}
                              className="ml-2 rounded p-1.5 text-neutral-400 hover:text-white transition-colors"
                            >
                              {isThisPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
