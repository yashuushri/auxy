"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, User, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export function AuthForm({
  mode: initialMode = "login",
  compact = false,
}: {
  mode?: "login" | "register";
  compact?: boolean;
} = {}) {
  const { loginWithEmail, signUpWithEmail, loginAsGuest } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (tab === "register") {
        const cleanName = name.trim() || cleanEmail.split("@")[0];
        const res = await signUpWithEmail(cleanEmail, password, cleanName);
        if (res.success) {
          router.replace("/");
        } else if (res.error) {
          setErrorMsg(res.error);
        }
      } else {
        const res = await loginWithEmail(cleanEmail, password);
        if (res.success) {
          router.replace("/");
        } else if (res.error) {
          setErrorMsg(res.error);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGuest() {
    loginAsGuest("Guest");
    router.replace("/");
  }

  const content = (
    <Card className="w-full max-w-sm border-white/10 bg-[#101017]/90 text-white shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden">
      {/* Top Tab Switcher */}
      <div className="flex border-b border-white/10 bg-white/[0.02] p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setTab("login");
            setErrorMsg(null);
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            tab === "login"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("register");
            setErrorMsg(null);
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            tab === "register"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Create Account
        </button>
      </div>

      <CardHeader className="text-center pb-3 pt-5">
        <div className="relative mx-auto mb-2 size-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1 shadow-md">
          <Image
            src="/logo.png"
            alt="Auxy"
            fill
            sizes="48px"
            className="object-contain p-1"
            priority
            referrerPolicy="no-referrer"
          />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">
          {tab === "register" ? "Create your Account" : "Sign in to Auxy"}
        </CardTitle>
        <CardDescription className="text-neutral-400 text-xs mt-1">
          {tab === "register"
            ? "Enter your details to save your rooms and playlists."
            : "Enter your email and password to access your room."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-1">
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {tab === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Name / Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name or handle"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300">
                Password
              </label>
              {tab === "register" && (
                <span className="text-[11px] text-neutral-500">Min. 6 characters</span>
              )}
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-10 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-sm rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{tab === "register" ? "Creating Account..." : "Signing In..."}</span>
              </>
            ) : (
              <span>{tab === "register" ? "Create Account" : "Sign In"}</span>
            )}
          </Button>
        </form>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#101017] px-2 text-neutral-500">or</span>
          </div>
        </div>

        {/* Instant Guest / Explore Button */}
        <button
          type="button"
          onClick={handleGuest}
          className="w-full h-9 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="size-3.5 text-amber-400" />
          <span>Continue as Guest</span>
        </button>

        {!compact && (
          <div className="pt-2 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to home</span>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (compact) {
    return content;
  }

  return (
    <div className="page-in relative flex min-h-svh flex-col items-center justify-center bg-[#09090e] px-4 py-10 text-white selection:bg-white/20">
      {content}
    </div>
  );
}
