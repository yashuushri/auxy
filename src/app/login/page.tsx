"use client";

import { useAuth } from "@/context/auth-context";
import { DesktopHome } from "@/components/desktop-home";
import { LandingPage } from "@/components/landing-page";

export default function LoginPage() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#070709] text-white">
        <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (user) {
    return <DesktopHome />;
  }

  return <LandingPage initialView="login" />;
}

