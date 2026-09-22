"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Music2, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const pathname = usePathname();

  // Extract possible username slug if user visited /username or /@username
  const trimmed = (pathname || "").replace(/^\/+/, "").replace(/\/+$/, "");
  const singleSlug = !trimmed.includes("/") ? trimmed.replace(/^@/, "") : null;
  const isLikelyUsername =
    singleSlug &&
    singleSlug.length >= 2 &&
    !["api", "auth", "login", "register", "u"].includes(singleSlug.toLowerCase()) &&
    !singleSlug.includes(".");

  return (
    <div
      id="not-found-container"
      className="flex min-h-svh flex-col items-center justify-center bg-[#0a0a0f] text-white px-4 text-center select-none"
      suppressHydrationWarning
    >
      <div
        id="not-found-content"
        className="flex flex-col items-center max-w-md w-full p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl"
        suppressHydrationWarning
      >
        <div
          id="not-found-brand"
          className="mb-6 flex items-center gap-2.5 text-sm font-semibold text-white/90"
          suppressHydrationWarning
        >
          <div className="relative size-6 overflow-hidden rounded-lg">
            <Image
              src="/logo.png"
              alt="Auxy"
              fill
              sizes="24px"
              className="object-contain"
              priority
              referrerPolicy="no-referrer"
            />
          </div>
          <span>Auxy</span>
        </div>

        <div
          id="not-found-icon-wrapper"
          className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
          suppressHydrationWarning
        >
          <Music2 className="size-8 text-white/60" />
        </div>

        <span
          id="not-found-badge"
          className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2"
          suppressHydrationWarning
        >
          404 &bull; Page Not Found
        </span>

        <h1
          id="not-found-title"
          className="text-2xl font-bold tracking-tight text-white sm:text-3xl mb-3"
          suppressHydrationWarning
        >
          Lost in the sound
        </h1>

        <p
          id="not-found-description"
          className="text-sm text-neutral-400 leading-relaxed mb-6"
          suppressHydrationWarning
        >
          The page or room you are looking for doesn&apos;t exist or has moved.
        </p>

        {isLikelyUsername && (
          <div
            id="not-found-user-suggestion"
            className="mb-6 w-full p-3 rounded-xl border border-white/15 bg-white/5 text-left flex items-center justify-between gap-3"
            suppressHydrationWarning
          >
            <div className="flex items-center gap-2.5 min-w-0" suppressHydrationWarning>
              <User className="size-4 text-white/60 shrink-0" />
              <div className="truncate text-xs" suppressHydrationWarning>
                <span className="text-white/60">Looking for user? </span>
                <span className="font-semibold text-white">@{singleSlug}</span>
              </div>
            </div>
            <Link href={`/u/${encodeURIComponent(singleSlug)}`}>
              <Button
                id="not-found-visit-profile-btn"
                size="sm"
                className="h-7 text-xs bg-white text-black hover:bg-white/90 rounded-lg px-2.5 font-medium shrink-0 cursor-pointer"
              >
                View Profile
              </Button>
            </Link>
          </div>
        )}

        <div id="not-found-actions" className="flex flex-wrap items-center justify-center gap-3 w-full" suppressHydrationWarning>
          <Link href="/" className="w-full sm:w-auto">
            <Button
              id="not-found-back-home-btn"
              variant="outline"
              className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-xl h-10 px-5 text-sm cursor-pointer"
            >
              <Home className="mr-2 size-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
