"use client";

import { useAuth } from "@/context/auth-context";
import { DesktopHome } from "@/components/desktop-home";
import { LandingPage } from "@/components/landing-page";

export default function HomePage() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#070709] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <span className="text-xs text-neutral-400 font-medium tracking-wide">Loading Auxy...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage initialView="hero" />;
  }

  return <DesktopHome />;
}

