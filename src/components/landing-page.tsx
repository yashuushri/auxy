"use client";

import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export function LandingPage() {
  return (
    <div className="page-in flex min-h-svh flex-col bg-[#09090e] text-white selection:bg-white/20">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 px-6">
        <div className="flex items-center gap-2.5 text-sm font-medium text-white/90">
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
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-xs font-medium text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Hero & Direct Normal Auth Section */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col lg:flex-row items-center justify-center gap-12 px-6 py-12">
        <div className="flex flex-1 flex-col items-center lg:items-start text-center lg:text-left max-w-lg">
          <div className="relative mb-6 size-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 shadow-xl shadow-black/40 backdrop-blur-xl">
            <Image
              src="/logo.png"
              alt="Auxy"
              fill
              sizes="64px"
              className="object-contain p-1"
              priority
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Curate your room, customize atmosphere, and play.
          </h1>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-neutral-400">
            Sign in to access your customized room backgrounds, saved tracks,
            YouTube playlist imports, and a floating draggable player.
          </p>
          <div className="mt-6 flex items-center gap-6 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>Real-time Cloud Sync</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-blue-400" />
              <span>Free Forever</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm flex justify-center">
          <AuthForm compact mode="login" />
        </div>
      </main>
    </div>
  );
}
