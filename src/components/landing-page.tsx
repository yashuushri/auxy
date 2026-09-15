"use client";

import Link from "next/link";
import { Music2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingPage() {
  return (
    <div className="page-in flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          aria-label="Reload Shree's Playlist"
          onClick={() => window.location.reload()}
        >
          <Music2 className="size-4" />
          Shree&apos;s Playlist
        </button>
        <div className="flex items-center gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
            Sign in
          </Link>
          <Link href="/register" className={cn(buttonVariants())}>
            Sign up
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="text-muted-foreground mb-3 text-sm">A personal music room</p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Sign in, set your background, and play.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-lg text-base leading-7">
          Username and password login, then a profile card, compact player, playlists,
          and volume — built with shadcn/ui.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
            Create an account
          </Link>
          <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
