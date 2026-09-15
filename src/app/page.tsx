"use client";

import { DesktopHome } from "@/components/desktop-home";
import { LandingPage } from "@/components/landing-page";
import { useAuth } from "@/context/auth-context";

export default function HomePage() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="page-in flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return user ? <DesktopHome /> : <LandingPage />;
}
