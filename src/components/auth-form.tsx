"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function DiscordIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function AuthForm({ mode = "login" }: { mode?: "login" | "register" } = {}) {
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
    <div className="page-in relative flex min-h-svh flex-col items-center justify-center bg-[#09090e] px-4 py-10 text-white selection:bg-white/20">
      <Card className="w-full max-w-sm border-white/10 bg-white/[0.03] text-white shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="relative mx-auto mb-3 size-14 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-lg backdrop-blur-md">
            <Image
              src="/logo.png"
              alt="Auxy"
              fill
              sizes="56px"
              className="object-contain p-1"
              priority
              referrerPolicy="no-referrer"
            />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {mode === "register" ? "Join Auxy" : "Welcome to Auxy"}
          </CardTitle>
          <CardDescription className="text-neutral-400 text-xs mt-1">
            Sign in to sync your rooms and playlists across devices with Firebase.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-4">
          <Button
            type="button"
            onClick={handleGoogle}
            disabled={loadingGoogle || loadingDiscord}
            className="w-full h-11 bg-white hover:bg-neutral-200 text-neutral-900 font-medium text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2.5"
          >
            <GoogleIcon className="size-4" />
            <span>{loadingGoogle ? "Connecting..." : "Continue with Google"}</span>
          </Button>

          <Button
            type="button"
            onClick={handleDiscord}
            disabled={loadingGoogle || loadingDiscord}
            className="w-full h-11 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-all duration-200 shadow-md shadow-[#5865F2]/20 flex items-center justify-center gap-2.5"
          >
            <DiscordIcon className="size-4" />
            <span>{loadingDiscord ? "Connecting..." : "Instant Demo / Guest Room"}</span>
          </Button>

          <p className="text-center text-[11px] text-neutral-500 mt-2">
            Secure cloud synchronization powered by Google Firebase Firestore.
          </p>

          <div className="pt-2 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to home</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
