"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { GoogleIcon, DiscordIcon } from "@/components/auth-form";

export function LandingPage() {
  const { loginWithGoogle, loginWithDiscord } = useAuth();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingDiscord, setLoadingDiscord] = useState(false);

  async function handleGoogle() {
    setLoadingGoogle(true);
    try {
      await loginWithGoogle();
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleDiscord() {
    setLoadingDiscord(true);
    try {
      await loginWithDiscord();
    } finally {
      setLoadingDiscord(false);
    }
  }

  return (
    <div className="page-in flex min-h-svh flex-col bg-[#09090e] text-white selection:bg-white/20">
      <header className="flex h-14 items-center justify-between border-b border-white/5 px-6">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-white/90 hover:text-white transition-colors"
          aria-label="Auxy Home"
          onClick={() => window.location.reload()}
        >
          <div className="relative size-6 overflow-hidden rounded-md">
            <Image
              src="/logo.png"
              alt="Auxy Logo"
              fill
              sizes="24px"
              className="object-contain"
              priority
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-semibold tracking-wide">Auxy</span>
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGoogle}
            disabled={loadingGoogle || loadingDiscord}
            className="bg-white hover:bg-neutral-200 text-neutral-950 font-medium text-xs px-3.5 h-8 shadow-sm flex items-center gap-1.5"
          >
            <GoogleIcon className="size-3.5" />
            <span>{loadingGoogle ? "Connecting..." : "Sign in with Google"}</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <div className="relative mb-6 size-24 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <Image
            src="/logo.png"
            alt="Auxy"
            fill
            sizes="96px"
            className="object-contain p-2"
            priority
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl text-white">
          Sign in, curate your room, and play.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-neutral-400">
          Real-time Firebase Firestore synchronization, shareable public profiles,
          YouTube playlist imports, and a floating draggable player.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={handleGoogle}
            disabled={loadingGoogle || loadingDiscord}
            className="h-12 px-6 bg-white hover:bg-neutral-200 text-neutral-950 font-medium text-sm shadow-xl flex items-center gap-2"
          >
            <GoogleIcon className="size-5" />
            <span>{loadingGoogle ? "Connecting..." : "Continue with Google"}</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleDiscord}
            disabled={loadingGoogle || loadingDiscord}
            className="h-12 px-6 border-white/15 bg-white/5 hover:bg-white/10 text-white font-medium text-sm flex items-center gap-2"
          >
            <DiscordIcon className="size-5 text-[#5865F2]" />
            <span>{loadingDiscord ? "Connecting..." : "Instant Demo Room"}</span>
          </Button>
        </div>
      </main>
    </div>
  );
}
