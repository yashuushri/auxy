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
      className="relative min-h-svh bg-[#070709] text-white selection:bg-orange-500/20 overflow-x-hidden flex flex-col justify-between"
    >
      {/* Background with Procedural Liquid Shader */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <AnimatedLiquidBackground />
        {/* Balanced clear overlay */}
        <div
          id="landing-bg-blur-overlay"
          className="absolute inset-0 bg-black/20"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#070709]/80" />
      </div>

      {/* Top Header - Compact & Sleek */}
      <header
        id="landing-header"
        className="relative z-30 flex h-13 sm:h-14 items-center justify-between px-5 sm:px-10 lg:px-12 backdrop-blur-md bg-black/20 border-b border-white/5"
      >
        {/* Auxy Brand */}
        <div
          id="landing-brand"
          onClick={() => setView("hero")}
          className="flex items-center gap-2.5 text-sm font-medium text-white cursor-pointer hover:opacity-90 transition-opacity select-none"
        >
          <Image
            src="/logo.png"
            alt="Auxy Logo"
            width={28}
            height={28}
            className="size-6 sm:size-7 object-contain"
            priority
            referrerPolicy="no-referrer"
          />
          <span className="font-semibold text-base sm:text-lg tracking-tight text-white">Auxy</span>
        </div>

        {/* Right Navigation & Auth Actions */}
        <div id="landing-header-actions" className="flex items-center gap-2 sm:gap-3">
          {view === "hero" ? (
            <>
              <button
                type="button"
                id="header-sign-in-btn"
                onClick={() => setView("login")}
                className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                Sign in
              </button>
              <button
                type="button"
                id="header-sign-up-btn"
                onClick={() => setView("register")}
                className="text-xs sm:text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-3.5 sm:px-4 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer active:scale-95"
              >
                Sign up
              </button>
            </>
          ) : view === "login" ? (
            <button
              type="button"
              id="header-sign-up-toggle-btn"
              onClick={() => setView("register")}
              className="text-xs sm:text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-3.5 sm:px-4 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer active:scale-95"
            >
              Sign up
            </button>
          ) : (
            <button
              type="button"
              id="header-sign-in-toggle-btn"
              onClick={() => setView("login")}
              className="text-xs sm:text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-3.5 sm:px-4 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer active:scale-95"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Main Hero & Auth Viewport */}
      <main
        id="landing-main-viewport"
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10 sm:py-16"
      >
        {view === "hero" ? (
          <div
            id="landing-hero-section"
            className="flex flex-col items-center text-center max-w-3xl animate-in fade-in duration-300"
          >
            {/* Headline */}
            <h1
              id="hero-headline"
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold -tracking-[0.03em] text-white leading-[1.12] sm:leading-[1.1] drop-shadow-xl"
            >
              Sign in, set your vibe, <br className="hidden sm:inline" />
              and immerse in sound.
            </h1>

            {/* Subtitle */}
            <p
              id="hero-description"
              className="mt-5 sm:mt-6 text-sm sm:text-base md:text-lg leading-relaxed text-neutral-300/90 max-w-xl font-normal drop-shadow-md"
            >
              Your personal synchronized music space. Stream curated tracks, customize live atmospheres, and listen together in real-time.
            </p>

            {/* Action Buttons */}
            <div
              id="hero-cta-buttons"
              className="mt-8 sm:mt-10 flex flex-row items-center justify-center gap-3 sm:gap-4"
            >
              <button
                type="button"
                id="hero-sign-in-btn"
                onClick={() => setView("login")}
                className="h-10 px-6 rounded-lg bg-black/60 hover:bg-white/10 border border-white/20 text-white font-medium text-xs sm:text-sm transition-all duration-300 cursor-pointer active:scale-[0.98] backdrop-blur-md shadow-sm"
              >
                Sign in
              </button>
              <CtaActionButton
                id="hero-create-account-btn"
                onClick={() => setView("register")}
              >
                Get started free
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
    </div>
  );
}
