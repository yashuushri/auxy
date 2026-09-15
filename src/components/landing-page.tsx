"use client";

import { useState } from "react";
import Image from "next/image";
import { AuthForm } from "@/components/auth-form";
import { AnimatedLiquidBackground } from "@/components/animated-liquid-background";
import { CtaActionButton } from "@/components/cta-action-button";

interface LandingPageProps {
  initialView?: "hero" | "login" | "register" | "forgot";
}

export function LandingPage({ initialView = "hero" }: LandingPageProps) {
  const [view, setView] = useState<"hero" | "login" | "register" | "forgot">(initialView);

  return (
    <div
      id="landing-container"
      className="relative flex min-h-svh flex-col justify-between overflow-hidden bg-[#070709] text-white selection:bg-orange-500/20"
    >
      {/* Dedicated Lava Shader Background */}
      <AnimatedLiquidBackground />

      {/* Atmospheric subtle blur overlay strictly for the landing page */}
      <div
        id="landing-bg-blur-overlay"
        className="absolute inset-0 pointer-events-none backdrop-blur-md bg-black/10 z-0"
        aria-hidden="true"
      />

      {/* Top Navigation Bar */}
      <header
        id="landing-header"
        className="relative z-10 flex h-16 items-center justify-between px-6 sm:px-10"
      >
        {/* Auxy Brand with Logo */}
        <div
          id="landing-brand"
          onClick={() => setView("hero")}
          className="flex items-center gap-2.5 text-sm font-medium text-white/95 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Image
            src="/logo.png"
            alt="Auxy Logo"
            width={30}
            height={30}
            className="size-7 sm:size-8 object-contain"
            priority
            referrerPolicy="no-referrer"
          />
          <span className="font-semibold text-base tracking-tight">Auxy</span>
        </div>

        {/* Right Controls */}
        <div id="landing-header-actions" className="flex items-center gap-2.5 sm:gap-3">
          {view === "hero" ? (
            <>
              <button
                type="button"
                id="header-sign-in-btn"
                onClick={() => setView("login")}
                className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white px-3 py-1.5 transition-colors cursor-pointer"
              >
                Sign in
              </button>
              <button
                type="button"
                id="header-sign-up-btn"
                onClick={() => setView("register")}
                className="text-xs sm:text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer"
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

      {/* Main Viewport */}
      <main
        id="landing-main-viewport"
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12"
      >
        {view === "hero" ? (
          <div
            id="landing-hero-section"
            className="flex flex-col items-center text-center max-w-2xl animate-in fade-in duration-300"
          >
            {/* Sub-eyebrow */}
            <p
              id="hero-eyebrow"
              className="text-xs sm:text-sm font-medium text-neutral-300/80 tracking-wide mb-3 px-3 py-1 rounded-full bg-white/5 border border-white/10"
            >
              A personal music room
            </p>

            {/* Headline */}
            <h1
              id="hero-headline"
              className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md"
            >
              Sign in, set your vibe, and play.
            </h1>

            {/* Description */}
            <p
              id="hero-description"
              className="mt-4 text-sm sm:text-base leading-relaxed text-neutral-300/90 max-w-xl drop-shadow-sm"
            >
              Your personal music sanctuary. Stream curated tracks, customize atmospheric visual
              rooms, import YouTube playlists, and experience high-fidelity sound on your own terms.
            </p>

            {/* Action Buttons */}
            <div
              id="hero-cta-buttons"
              className="mt-8 flex flex-row items-center justify-center gap-3"
            >
              <button
                type="button"
                id="hero-sign-in-btn"
                onClick={() => setView("login")}
                className="h-10 px-5 rounded-lg bg-black/60 hover:bg-white/15 border border-white/20 text-white font-medium text-sm transition-all duration-300 cursor-pointer active:scale-[0.98]"
              >
                Sign in
              </button>
              <CtaActionButton
                id="hero-create-account-btn"
                onClick={() => setView("register")}
              >
                Create account
              </CtaActionButton>
            </div>
          </div>
        ) : (
          <div
            id="landing-auth-view"
            className="w-full flex justify-center animate-in fade-in duration-200"
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

      {/* Footer */}
      <footer
        id="landing-footer"
        className="relative z-10 h-12 flex items-center justify-center text-xs text-neutral-400/80"
      >
        <span>Auxy • All your music in one place</span>
      </footer>
    </div>
  );
}
