"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Music2,
  Sparkles,
  Users2,
  PlaySquare,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  Flame,
  Volume2,
  Headphones,
} from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { AnimatedLiquidBackground } from "@/components/animated-liquid-background";
import { CtaActionButton } from "@/components/cta-action-button";

interface LandingPageProps {
  initialView?: "hero" | "login" | "register" | "forgot";
}

export function LandingPage({ initialView = "hero" }: LandingPageProps) {
  const [view, setView] = useState<"hero" | "login" | "register" | "forgot">(initialView);

  const scrollToFeatures = () => {
    const el = document.getElementById("landing-features-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleOpenAuth = (mode: "login" | "register") => {
    setView(mode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      id="landing-container"
      className="relative min-h-svh bg-[#070709] text-white selection:bg-orange-500/20"
    >
      {/* Background with Lava Shader for top viewport and smooth dark gradient below */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <AnimatedLiquidBackground />
        {/* Subtle dark backdrop and blur */}
        <div
          id="landing-bg-blur-overlay"
          className="absolute inset-0 backdrop-blur-[6px] bg-black/40"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#070709]/80 to-[#070709]" />
      </div>

      <div className="relative z-10 flex min-h-svh flex-col justify-between">
        {/* Top Sticky/Fixed Navigation Bar */}
        <header
          id="landing-header"
          className="sticky top-0 z-30 flex h-16 items-center justify-between px-6 sm:px-12 backdrop-blur-md bg-black/30 border-b border-white/5"
        >
          {/* Auxy Brand with Logo */}
          <div
            id="landing-brand"
            onClick={() => {
              setView("hero");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5 text-sm font-medium text-white/95 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Image
              src="/logo.png"
              alt="Auxy Logo"
              width={32}
              height={32}
              className="size-7 sm:size-8 object-contain"
              priority
              referrerPolicy="no-referrer"
            />
            <span className="font-semibold text-base tracking-tight">Auxy</span>
          </div>

          {/* Right Controls */}
          <div id="landing-header-actions" className="flex items-center gap-2 sm:gap-3">
            {view === "hero" ? (
              <>
                <button
                  type="button"
                  id="header-sign-in-btn"
                  onClick={() => handleOpenAuth("login")}
                  className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white px-2.5 sm:px-3.5 py-1.5 transition-colors cursor-pointer"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  id="header-sign-up-btn"
                  onClick={() => handleOpenAuth("register")}
                  className="text-xs sm:text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-3 sm:px-4 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  Sign up
                </button>
              </>
            ) : (
              <button
                type="button"
                id="header-back-home-btn"
                onClick={() => setView("hero")}
                className="text-xs font-medium text-neutral-400 hover:text-white px-2.5 py-1.5 transition-colors cursor-pointer"
              >
                Home
              </button>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <main
          id="landing-main-viewport"
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-20"
        >
          {view === "hero" ? (
            <div
              id="landing-hero-section"
              className="flex flex-col items-center text-center max-w-3xl animate-in fade-in duration-300"
            >
              {/* Badge */}
              <div
                id="hero-eyebrow"
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-orange-200/90 tracking-wide mb-4 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 backdrop-blur-md"
              >
                <Sparkles className="size-3.5 text-orange-400" />
                <span>Next-Generation Atmospheric Music Room</span>
              </div>

              {/* Headline */}
              <h1
                id="hero-headline"
                className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] drop-shadow-md"
              >
                Sign in, set your vibe, <br className="hidden sm:inline" />
                and immerse in sound.
              </h1>

              {/* Description */}
              <p
                id="hero-description"
                className="mt-4 sm:mt-5 text-sm sm:text-lg leading-relaxed text-neutral-300/90 max-w-2xl drop-shadow-sm font-normal"
              >
                Your personal synchronized music sanctuary. Stream curated YouTube tracks & playlists,
                experience dynamic procedural liquid WebGL shaders, customize live room themes, and listen together in real-time.
              </p>

              {/* Action Buttons */}
              <div
                id="hero-cta-buttons"
                className="mt-7 sm:mt-9 flex flex-row items-center justify-center gap-3"
              >
                <button
                  type="button"
                  id="hero-sign-in-btn"
                  onClick={() => handleOpenAuth("login")}
                  className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl bg-black/60 hover:bg-white/10 border border-white/20 text-white font-medium text-xs sm:text-sm transition-all duration-300 cursor-pointer active:scale-[0.98] backdrop-blur-md"
                >
                  Sign in
                </button>
                <CtaActionButton
                  id="hero-create-account-btn"
                  onClick={() => handleOpenAuth("register")}
                >
                  Get started free
                </CtaActionButton>
              </div>

              {/* Scroll down indicator */}
              <button
                type="button"
                id="hero-scroll-indicator"
                onClick={scrollToFeatures}
                className="mt-14 sm:mt-20 flex flex-col items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer group"
              >
                <span className="text-[11px] font-medium tracking-wider uppercase text-neutral-400 group-hover:text-white">
                  Discover Auxy features
                </span>
                <ChevronDown className="size-4 animate-bounce text-neutral-400 group-hover:text-white" />
              </button>
            </div>
          ) : (
            <div
              id="landing-auth-view"
              className="w-full flex justify-center animate-in fade-in duration-200 py-6"
            >
              <AuthForm
                mode={view}
                compact
                onBack={() => setView("hero")}
                onSwitchMode={(mode) => setView(mode)}
              />
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* SCROLLABLE LANDING PAGE CONTENT (When viewing Hero) */}
      {/* ========================================================================= */}
      {view === "hero" && (
        <div id="landing-scroll-content" className="relative z-10 w-full space-y-24 sm:space-y-32 pb-20">
          {/* SECTION 1: Key Feature Highlights Grid */}
          <section
            id="landing-features-section"
            className="mx-auto max-w-6xl px-5 sm:px-8 pt-8"
          >
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
              <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase">
                Core Capabilities
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mt-2">
                Built for deep focus, chill sessions, and shared beats
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-3 leading-relaxed">
                Everything you need to transform your desktop into an ambient audiovisual soundstage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between hover:border-orange-500/30 transition-all group">
                <div>
                  <div className="size-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-5 text-orange-400 group-hover:scale-105 transition-transform">
                    <PlaySquare className="size-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    Direct YouTube & Playlist Streaming
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-2.5 leading-relaxed">
                    Instantly load single tracks or full YouTube playlists. High-fidelity audio playback with zero distractions and seamless queuing.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-orange-300 font-medium">
                  <Music2 className="size-3.5" />
                  <span>Unlimited tracks & queues</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between hover:border-purple-500/30 transition-all group">
                <div>
                  <div className="size-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-5 text-purple-400 group-hover:scale-105 transition-transform">
                    <Flame className="size-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    Live Liquid WebGL & Video Shaders
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-2.5 leading-relaxed">
                    Immerse yourself in real-time 60fps GPU shaders — Lava, Prism, Plasma, Vortex — plus cinematic video backgrounds streamed via Discord CDN.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-purple-300 font-medium">
                  <Layers className="size-3.5" />
                  <span>Customizable color & speed</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between hover:border-emerald-500/30 transition-all group">
                <div>
                  <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 group-hover:scale-105 transition-transform">
                    <Users2 className="size-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    Listen Together with Realtime Sync
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-2.5 leading-relaxed">
                    Host a room or join friends. Supabase Realtime synchronization broadcasts current tracks, seek times, and room atmospheres to all listeners.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-300 font-medium">
                  <Radio className="size-3.5" />
                  <span>Sub-second playback sync</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Ambient Desktop Soundstage Showcase */}
          <section
            id="landing-soundstage-section"
            className="mx-auto max-w-6xl px-5 sm:px-8"
          >
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-neutral-900/60 to-black/80 backdrop-blur-xl p-8 sm:p-12 overflow-hidden relative">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-neutral-300">
                    <SlidersHorizontal className="size-3.5 text-orange-400" />
                    <span>Modular Floating Workspace</span>
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                    A desktop made for music enthusiasts.
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Auxy blends a floating draggable player with sound wave analyzers, custom theme switchers, volume leveling, and an Explore catalog filled with fresh genres, lo-fi beats, and high-energy mixes.
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        <Volume2 className="size-4 text-orange-400" />
                        <span>Zero Lag Audio</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">Pure stream buffering without bloated browser tabs.</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        <Headphones className="size-4 text-purple-400" />
                        <span>Curated Vibes</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">Synthwave, anime lofi, chillhop & gaming sets.</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAuth("register")}
                      className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-4 sm:px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
                    >
                      <span>Join Auxy Room</span>
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Right Interactive Preview Card */}
                <div className="relative aspect-[4/3] w-full rounded-2xl bg-[#0e1017] border border-zinc-800/90 p-5 flex flex-col justify-between shadow-2xl overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10 pointer-events-none" />
                  
                  {/* Mock Player Header */}
                  <div className="flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-rose-500/80" />
                      <div className="size-3 rounded-full bg-amber-500/80" />
                      <div className="size-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded border border-white/5">
                      Auxy Room • Live
                    </span>
                  </div>

                  {/* Mock Track Info */}
                  <div className="my-auto text-center space-y-3 z-10">
                    <div className="size-16 sm:size-20 mx-auto rounded-2xl bg-gradient-to-tr from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-300">
                      <Music2 className="size-8 sm:size-10 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white">Midnight Cyber Odyssey</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Atmospheric Synthwave • 3:42 / 4:15</p>
                    </div>

                    {/* Mock Progress Bar */}
                    <div className="w-48 sm:w-64 mx-auto bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 to-rose-500 h-full w-3/4 rounded-full" />
                    </div>
                  </div>

                  {/* Mock Footer Badges */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 z-10 pt-3 border-t border-zinc-800/60">
                    <span className="flex items-center gap-1.5">
                      <Zap className="size-3 text-emerald-400" />
                      <span>PostgreSQL & Supabase Active</span>
                    </span>
                    <span className="font-mono text-orange-400">4 listeners in sync</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: Fast 3-Step Guide */}
          <section
            id="landing-how-it-works"
            className="mx-auto max-w-5xl px-5 sm:px-8"
          >
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase">
                How It Works
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Start listening in 3 simple steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <span className="text-xs font-mono font-semibold text-orange-400">01</span>
                <h3 className="text-sm font-semibold text-white">Create Account</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Sign up with email and secure OTP verification in less than 30 seconds.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <span className="text-xs font-mono font-semibold text-purple-400">02</span>
                <h3 className="text-sm font-semibold text-white">Choose Your Atmosphere</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Select your favorite liquid shader, live anime video, or dark minimalist background.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <span className="text-xs font-mono font-semibold text-emerald-400">03</span>
                <h3 className="text-sm font-semibold text-white">Queue & Sync</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Paste any YouTube link or playlist, invite friends, and enjoy synchronized playback.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: Final Bottom Call to Action */}
          <section
            id="landing-bottom-cta"
            className="mx-auto max-w-4xl px-5 sm:px-8 text-center"
          >
            <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-orange-950/40 via-black/80 to-purple-950/40 p-8 sm:p-12 backdrop-blur-md space-y-5">
              <ShieldCheck className="size-8 text-orange-400 mx-auto" />
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Ready to elevate your music listening?
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-lg mx-auto leading-relaxed">
                Join Auxy today to customize your music space and listen together with friends.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenAuth("register")}
                  className="h-10 sm:h-11 px-6 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-xs sm:text-sm transition-all shadow-lg cursor-pointer active:scale-95"
                >
                  Create free account
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("login")}
                  className="h-10 sm:h-11 px-5 rounded-xl bg-black/60 hover:bg-white/10 border border-white/20 text-white font-medium text-xs sm:text-sm transition-all cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer
            id="landing-footer"
            className="border-t border-white/5 pt-8 text-center text-xs text-neutral-500 space-y-2"
          >
            <div className="flex items-center justify-center gap-2 text-neutral-400">
              <Image
                src="/logo.png"
                alt="Auxy Logo"
                width={18}
                height={18}
                className="size-4 object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="font-semibold text-neutral-300">Auxy</span>
              <span>•</span>
              <span>Personal Atmospheric Music Space</span>
            </div>
            <p className="text-[11px] text-neutral-600">
              © {new Date().getFullYear()} Auxy. High-fidelity audio, WebGL shaders & Realtime Sync.
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
