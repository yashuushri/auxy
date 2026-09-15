"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { toast, Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  useEffect(() => {
    function dismissOnClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const item = target.closest("[data-sonner-toast]")
      if (!(item instanceof HTMLElement)) return
      if (item.getAttribute("data-type") === "loading") return
      const index = Number(item.getAttribute("data-index"))
      const toasts = toast.getToasts()
      const entry = (Number.isInteger(index) ? toasts[index] : undefined) ?? toasts[0]
      toast.dismiss(entry?.id)
    }
    document.addEventListener("click", dismissOnClick, true)
    return () => document.removeEventListener("click", dismissOnClick, true)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "22rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast cursor-pointer",
          title: "leading-snug",
          description: "leading-snug",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
