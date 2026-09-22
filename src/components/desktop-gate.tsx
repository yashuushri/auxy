"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";

function checkIsDesktopDisplay(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;

  // If in an iframe (e.g. AI Studio preview environment), ensure preview displays smoothly unless on actual mobile user agent
  const inIframe = window.self !== window.top;
  const ua = navigator.userAgent || "";
  const isMobileUa =
    /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|PlayBook|BB10|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      ua
    );
  if (inIframe && !isMobileUa) {
    return true;
  }

  const width = window.innerWidth;
  const platform = navigator.platform || "";
  const navAny = navigator as unknown as {
    userAgentData?: { mobile?: boolean; platform?: string };
    msMaxTouchPoints?: number;
  };

  // 1. Check navigator.userAgentData (Chromium on Android / Tablets)
  if (navAny.userAgentData) {
    if (navAny.userAgentData.mobile) {
      return false;
    }
    const uadPlatform = String(navAny.userAgentData.platform || "").toLowerCase();
    if (uadPlatform.includes("android")) {
      return false;
    }
  }

  // 2. Direct regex match for mobile & tablet User-Agents (Android, iOS, Tablets, etc.)
  if (isMobileUa) {
    return false;
  }

  // 3. Multi-touch / Touchscreen Detection
  const touchPoints =
    navigator.maxTouchPoints ||
    navAny.msMaxTouchPoints ||
    0;
  const hasTouch = touchPoints > 0 || "ontouchstart" in window;

  const isWindows = /Windows NT|Win32|Win64/i.test(ua) || /Win/i.test(platform);
  const isApple = /MacIntel/i.test(platform) || /Macintosh|Mac OS X|iPad|iPhone/i.test(ua);
  const isLinux = /Linux/i.test(platform) || /Linux/i.test(ua);

  // A. ANY Apple device with touch is an iPad or iPhone (Apple has never made a touch Mac)
  // Rotating iPad to horizontal/landscape will ALWAYS be caught here
  if (isApple && hasTouch) {
    return false;
  }

  // B. ANY Linux device with touch (Android tablets in landscape/desktop-site mode)
  if (isLinux && hasTouch && !isWindows) {
    return false;
  }

  // C. Mobile/Tablet orientation API exists on iOS & Android devices
  if (typeof (window as unknown as { orientation?: unknown }).orientation !== "undefined" && !isWindows) {
    return false;
  }

  // D. Coarse pointer (touch screen) check - tablet has touch screen
  if (typeof window.matchMedia === "function") {
    const hasCoarse = window.matchMedia("(any-pointer: coarse)").matches;
    if (hasCoarse && !isWindows && !(isApple && !hasTouch)) {
      return false;
    }
  }

  // E. Any device with touchscreen that is NOT a verified Windows PC
  // Tablets (Android, iPad, etc.) in horizontal are 100% touchscreens
  if (hasTouch && !isWindows) {
    return false;
  }

  // F. Viewport size check: A real desktop workspace requires at least 980px width
  if (width < 980) {
    return false;
  }

  return true;
}

export function DesktopGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    setMounted(true);

    function evaluate() {
      if (typeof window === "undefined") return;
      setIsDesktop(checkIsDesktopDisplay());
    }

    evaluate();

    const handleOrientation = () => {
      evaluate();
      setTimeout(evaluate, 50);
      setTimeout(evaluate, 150);
      setTimeout(evaluate, 300);
    };

    window.addEventListener("resize", handleOrientation);
    window.addEventListener("orientationchange", handleOrientation);

    if (screen?.orientation?.addEventListener) {
      screen.orientation.addEventListener("change", handleOrientation);
    }

    return () => {
      window.removeEventListener("resize", handleOrientation);
      window.removeEventListener("orientationchange", handleOrientation);
      if (screen?.orientation?.removeEventListener) {
        screen.orientation.removeEventListener("change", handleOrientation);
      }
    };
  }, []);

  // During SSR and initial client hydration, render children so the HTML matches 100%
  if (!mounted) {
    return <>{children}</>;
  }

  if (!isDesktop) {
    return (
      <div
        id="desktop-only-gate"
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0d0d10] text-[#ececec] px-6 selection:bg-white/10"
      >
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Monitor className="size-5 text-neutral-300 stroke-[1.75]" />
          </div>

          <h1
            id="desktop-gate-title"
            className="text-base sm:text-lg font-medium tracking-tight text-white"
          >
            Currently only available on your Desktop Screens
          </h1>

          <p
            id="desktop-gate-desc"
            className="mt-2.5 text-sm text-neutral-400 leading-relaxed max-w-xs"
          >
            Auxy is built for desktop workspaces. Please open on a desktop screen or enable &ldquo;Desktop site&rdquo; in your mobile browser.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
