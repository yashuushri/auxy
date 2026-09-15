"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

function isPhoneOrTablet() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return true;
  const touchMac = navigator.maxTouchPoints > 1 && /MacIntel/i.test(navigator.platform);
  return touchMac;
}

export function DesktopGate({ children }: { children: React.ReactNode }) {
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDeviceBlocked(isPhoneOrTablet());
  }, []);

  return (
    <>
      <div className={cn(mounted && deviceBlocked ? "hidden md:block" : "block")}>{children}</div>
      {mounted && deviceBlocked && (
        <div
          className="min-h-svh flex flex-col items-center justify-center bg-background px-6 py-16 text-center md:hidden"
        >
          <div className="mb-8 flex items-center gap-2 text-sm font-medium">
            <div className="relative size-5 overflow-hidden rounded-md">
              <Image
                src="/logo.png"
                alt="Auxy Logo"
                fill
                sizes="20px"
                className="object-contain"
                priority
                referrerPolicy="no-referrer"
              />
            </div>
            Auxy
          </div>
          <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border bg-card">
            <Monitor className="size-6" />
          </div>
          <p className="text-muted-foreground mb-3 text-sm">Desktop experience</p>
          <h1 className="max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
            This music room is optimized for wider screens.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-md text-base leading-7">
            Auxy features floating draggable windows on a background canvas.
            For the best experience, open on desktop or expand your browser window.
          </p>
        </div>
      )}
    </>
  );
}
