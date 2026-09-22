"use client";

import React from "react";

interface CtaActionButtonProps {
  id?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function CtaActionButton({
  id = "hero-create-account-btn",
  onClick,
  children = "Create account",
  className = "",
}: CtaActionButtonProps) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className={`group relative inline-flex h-9 sm:h-10 min-w-[142px] sm:min-w-[165px] items-center justify-between overflow-hidden rounded-lg bg-white hover:bg-black p-1 text-neutral-950 font-semibold text-xs sm:text-sm shadow-[0_2px_8px_rgba(0,0,0,0.14)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.45),0_0_12px_rgba(255,255,255,0.08)] active:scale-[0.98] transition-colors duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer select-none isolate ${className}`}
    >
      {/* Button Text on the left - Glides left & fades out smoothly on hover */}
      <span
        className="relative z-10 pl-2.5 sm:pl-3.5 pr-2 tracking-tight text-neutral-950 group-hover:text-white font-semibold whitespace-nowrap transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-8 group-hover:opacity-0 pointer-events-none transform-gpu will-change-[transform,opacity]"
      >
        {children}
      </span>

      {/* Expanding Black Pill with Arrow - Smoothly expands to 100% full width from right to left */}
      <div
        className="absolute right-1 top-1 bottom-1 w-7 sm:w-8 rounded-[6px] bg-black flex items-center justify-center transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:right-0 group-hover:top-0 group-hover:bottom-0 group-hover:w-full group-hover:rounded-lg pointer-events-none z-0 transform-gpu will-change-[width,right,top,bottom,border-radius]"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 14 14"
          className="size-3 sm:size-3.5 transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-45 group-hover:scale-110"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M 10.653 7.875 L 0 7.875 L 0 6.125 L 10.653 6.125 L 5.753 1.225 L 7 0 L 14 7 L 7 14 L 5.753 12.775 Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    </button>
  );
}
