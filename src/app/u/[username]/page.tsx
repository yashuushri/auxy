"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Copy, Check, Star, Play, Pause, Music2, Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { fetchPublicProfileFromFirestore } from "@/lib/firebase";
import type { PublicProfile } from "@/lib/types";

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { user } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlay, addTracks, setActivePlaylist } = usePlayer();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [starCount, setStarCount] = useState(0);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cleanUser = username.trim().toLowerCase();
        // 1. Try Firestore direct client fetch
        const firestoreProfile = await fetchPublicProfileFromFirestore(cleanUser);
        if (firestoreProfile && !cancelled) {
          setProfile(firestoreProfile);
          setStarCount(firestoreProfile.starCount);
          setIsStarred(firestoreProfile.isStarred);
          if (firestoreProfile.playlists?.length > 0) {
            setSelectedPlaylistId(firestoreProfile.playlists[0].id);
          }
          setLoading(false);
          return;
        }

        // 2. Fallback to API route
        const res = await fetch(`/api/u/${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error("Profile not found");
        const data = await res.json();
        if (!cancelled && data.profile) {
          setProfile(data.profile);
          setStarCount(data.profile.starCount);
          setIsStarred(data.profile.isStarred);
          if (data.profile.playlists?.length > 0) {
            setSelectedPlaylistId(data.profile.playlists[0].id);
          }
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  function copyProfileUrl() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Profile link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleToggleStar() {
    if (!profile) return;
    const nextState = !isStarred;
    setIsStarred(nextState);
    setStarCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starredUserId: profile.id,
          userId: user?.id || "anon",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(nextState ? `Starred @${profile.username}` : `Unstarred @${profile.username}`);
    } catch {
      // Revert if failed
      setIsStarred(!nextState);
      setStarCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
      toast.error("Could not update star");
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

  const isOwner = user?.username?.toLowerCase() === profile.username.toLowerCase();

  return (
    <div className="page-in min-h-svh bg-[#08080c] text-white selection:bg-white/20">
      {/* Top minimal navigation bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-[#08080c]/80 px-6 backdrop-blur-md">
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
          {isOwner ? (
            <Link href="/">
              <Button size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                My Room
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={copyProfileUrl}
              className="border-white/15 bg-white/5 text-xs text-neutral-300 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="mr-1.5 size-3.5 text-emerald-400" /> : <Copy className="mr-1.5 size-3.5" />}
              {copied ? "Copied" : "Share Profile"}
            </Button>
          )}
        </div>
      </header>

      {/* Profile Header Card */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8">
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
                  <h1 className="text-2xl font-bold tracking-tight text-white">{profile.displayName}</h1>
                  <p className="text-sm text-neutral-400">@{profile.username}</p>
                </div>

                {/* Star & Share buttons */}
                <div className="mt-3 flex items-center justify-center sm:justify-end gap-2 sm:mt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleStar}
                    className={`border-white/15 transition-all ${
                      isStarred
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                        : "bg-white/5 text-neutral-200 hover:bg-white/10"
                    }`}
                  >
                    <Star className={`mr-1.5 size-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
                    <span>{starCount}</span>
                  </Button>

                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={copyProfileUrl}
                    title="Copy Profile URL"
                    className="border-white/15 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
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
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Music2 className="size-3.5 text-white/50" />
                  {profile.playlists.length} Public {profile.playlists.length === 1 ? "Playlist" : "Playlists"}
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1.5">
                  <Star className="size-3.5 text-white/50" />
                  {starCount} {starCount === 1 ? "Star" : "Stars"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Public Playlists Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-lg font-semibold tracking-tight text-white">Public Playlists</h2>
          </div>

          {profile.playlists.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-neutral-400">
              <p className="text-sm">No public playlists shared yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Playlists sidebar / selector */}
              <div className="flex flex-col gap-2">
                {profile.playlists.map((pl) => {
                  const isSelected = selectedPlaylist?.id === pl.id;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-white/25 bg-white/10 shadow-lg shadow-black/40"
                          : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
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
                <div className="col-span-1 md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <div>
                      <h3 className="text-base font-semibold text-white">{selectedPlaylist.name}</h3>
                      {selectedPlaylist.description && (
                        <p className="text-xs text-neutral-400 mt-0.5">{selectedPlaylist.description}</p>
                      )}
                    </div>
                    {selectedPlaylist.tracks.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => playPlaylist(selectedPlaylist, 0)}
                        className="bg-white text-neutral-950 hover:bg-neutral-200"
                      >
                        <Play className="mr-1.5 size-3.5 fill-current" />
                        Play All
                      </Button>
                    )}
                  </div>

                  {/* Track rows */}
                  <div className="mt-3 flex flex-col divide-y divide-white/5">
                    {selectedPlaylist.tracks.length === 0 ? (
                      <p className="py-6 text-center text-xs text-neutral-500">No tracks in this playlist.</p>
                    ) : (
                      selectedPlaylist.tracks.map((track, idx) => {
                        const isThisPlaying = currentTrack?.youtubeId === track.youtubeId && isPlaying;
                        return (
                          <div
                            key={track.id || idx}
                            className="group flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="w-5 text-center text-xs text-neutral-500">{idx + 1}</span>
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
