"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/auth-context";
import { PlayerProvider } from "@/context/player-context";
import { DesktopGate } from "@/components/desktop-gate";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <DesktopGate>
        <TooltipProvider>
          <AuthProvider>
            <PlayerProvider>
              {children}
              <Toaster position="top-center" />
            </PlayerProvider>
          </AuthProvider>
        </TooltipProvider>
      </DesktopGate>
    </ThemeProvider>
  );
}
