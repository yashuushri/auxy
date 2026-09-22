"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/auth-context";
import { PlayerProvider } from "@/context/player-context";
import { ListenTogetherProvider } from "@/context/listen-together-context";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopGate } from "@/components/desktop-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <AuthProvider>
          <PlayerProvider>
            <ListenTogetherProvider>
              <DesktopGate>{children}</DesktopGate>
              <Toaster position="top-center" />
            </ListenTogetherProvider>
          </PlayerProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

