"use client";

import React, { useState } from "react";
import { Sparkles, Crown, Zap, Headphones, Film, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState<"lifetime" | "monthly">("lifetime");
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = () => {
    setIsActivating(true);
    setTimeout(() => {
      setIsActivating(false);
      onOpenChange(false);
      toast.success("Auxy Pro unlocked! Enjoy Dolby Atmos & Spatial Audio features.");
    }, 800);
  };

  const PRO_PERKS = [
    {
      icon: Headphones,
      title: "Dolby Atmos & 8D Spatial Audio",
      desc: "True 3D binaural rotation engine for theater-grade depth on any headphones.",
    },
    {
      icon: Film,
      title: "Full 4K Motion Shaders",
      desc: "Access to all cinematic animated background shaders with zero lag.",
    },
    {
      icon: Zap,
      title: "Lossless Audio & Max 100 YouTube Queue",
      desc: "Ultra-fast playlist caching, instant streaming, and high fidelity playback.",
    },
    {
      icon: Crown,
      title: "Fluid macOS Dock & Limitless Widgets",
      desc: "Customize apps, liquid shaders, and personal notes on your desktop canvas.",
    },
    {
      icon: ShieldCheck,
      title: "Priority Room Host & Listen Together",
      desc: "Zero-latency synchronization with friends in public and private rooms.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] border-white/15 bg-[#0e0e17]/95 p-6 text-white shadow-2xl backdrop-blur-xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent shadow-[0_0_24px_rgba(245,158,11,0.25)]">
            <Crown className="size-6 text-amber-300" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Upgrade to <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400 bg-clip-text text-transparent">Auxy Pro</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-white/60">
            Unlock the ultimate audiophile experience with spatial acoustics and fluid shaders.
          </DialogDescription>
        </DialogHeader>

        {/* Perks list */}
        <div className="my-4 space-y-3">
          {PRO_PERKS.map((perk, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.06]"
            >
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
                <perk.icon className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white/95">{perk.title}</h4>
                <p className="text-[11px] text-white/50 leading-relaxed">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plan options */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setSelectedPlan("lifetime")}
            className={`relative flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer ${
              selectedPlan === "lifetime"
                ? "border-amber-400/60 bg-amber-400/10 shadow-[0_0_16px_rgba(245,158,11,0.15)]"
                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
            }`}
          >
            <span className="absolute -top-2.5 right-3 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
              Popular
            </span>
            <span className="text-xs font-semibold text-white">Lifetime Access</span>
            <span className="mt-1 text-lg font-bold text-amber-300">Free Pass</span>
            <span className="text-[10px] text-white/40">Early Supporter Edition</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan("monthly")}
            className={`flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer ${
              selectedPlan === "monthly"
                ? "border-amber-400/60 bg-amber-400/10 shadow-[0_0_16px_rgba(245,158,11,0.15)]"
                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
            }`}
          >
            <span className="text-xs font-semibold text-white">Supporter</span>
            <span className="mt-1 text-lg font-bold text-white/90">VIP Perks</span>
            <span className="text-[10px] text-white/40">Included for All Users</span>
          </button>
        </div>

        {/* Action Button */}
        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full h-10 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 hover:opacity-95 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
          >
            <Sparkles className="size-4 mr-1.5 fill-black" />
            {isActivating ? "Activating Pro..." : "Activate Pro Access Now"}
          </Button>
          <p className="text-center text-[10px] text-white/40">
            Enjoy full access with no credit card required.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
