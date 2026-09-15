"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { GripHorizontal, Maximize2, Minimize2, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WindowCompactContext = createContext(false);
const HugContentContext = createContext<(hug: boolean) => void>(() => undefined);

export function useWindowCompact() {
  return useContext(WindowCompactContext);
}

export function useHugWindowContent(hug: boolean) {
  const setHug = useContext(HugContentContext);
  useEffect(() => {
    setHug(hug);
    return () => setHug(false);
  }, [hug, setHug]);
}

type WindowLayout = { x: number; y: number; width: number; height: number };

type FloatingWindowProps = {
  title: string;
  children: React.ReactNode;
  defaultX: number;
  defaultY: number;
  open?: boolean;
  onClose?: () => void;
  className?: string;
  widthClassName?: string;
  resizable?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
  minHeight?: number;
  maxTop?: number;
  persistKey?: string;
  centerDefault?: boolean;
};

function readLayout(key: string): WindowLayout | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WindowLayout;
    if (![parsed.x, parsed.y, parsed.width, parsed.height].every((n) => typeof n === "number" && Number.isFinite(n))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLayout(key: string, layout: WindowLayout) {
  localStorage.setItem(key, JSON.stringify(layout));
}

function clampLayout(
  layout: WindowLayout,
  viewport: { width: number; height: number },
  maxTop: number,
  minHeight: number
): WindowLayout {
  const width = Math.min(Math.max(MIN_WIDTH, layout.width), Math.max(MIN_WIDTH, viewport.width - VIEW_PAD * 2));
  const height = Math.min(
    Math.max(minHeight, layout.height),
    Math.max(minHeight, viewport.height - maxTop - VIEW_PAD)
  );
  const maxX = Math.max(VIEW_PAD, viewport.width - width - VIEW_PAD);
  const maxY = Math.max(maxTop, viewport.height - 48);
  return {
    x: Math.min(Math.max(VIEW_PAD, layout.x), maxX),
    y: Math.min(Math.max(maxTop, layout.y), maxY),
    width,
    height,
  };
}

const MIN_WIDTH = 340;
const VIEW_PAD = 16;
const LIBRARY_SPACE = 180;

export function FloatingWindow({
  title,
  children,
  defaultX,
  defaultY,
  open = true,
  onClose,
  className,
  widthClassName,
  resizable = false,
  defaultWidth = 400,
  defaultHeight = 560,
  minHeight = 280,
  maxTop = VIEW_PAD,
  persistKey,
  centerDefault = false,
}: FloatingWindowProps) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [zIndex, setZIndex] = useState(20);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [layoutReady, setLayoutReady] = useState(!persistKey && !centerDefault);
  const [hugContent, setHugContent] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resize = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(null);
  const restore = useRef({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight });
  const defaultsRef = useRef({
    defaultX,
    defaultY,
    defaultWidth,
    defaultHeight,
    centerDefault,
    maxTop,
    minHeight,
  });
  defaultsRef.current = {
    defaultX,
    defaultY,
    defaultWidth,
    defaultHeight,
    centerDefault,
    maxTop,
    minHeight,
  };

  function persistLayout(next: WindowLayout) {
    if (!persistKey || maximized) return;
    writeLayout(persistKey, next);
  }

  useEffect(() => {
    function sync() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const current = defaultsRef.current;
    sync();
    const saved = persistKey ? readLayout(persistKey) : null;
    const fallbackWidth = Math.min(current.defaultWidth, vw - VIEW_PAD * 2);
    const fallbackHeight = Math.min(current.defaultHeight, vh - current.maxTop - VIEW_PAD);
    const next = clampLayout(
      saved ?? {
        x: current.centerDefault ? Math.round((vw - fallbackWidth) / 2) : current.defaultX,
        y: current.centerDefault
          ? Math.max(current.maxTop, Math.round((vh - fallbackHeight) / 2))
          : current.defaultY,
        width: fallbackWidth,
        height: fallbackHeight,
      },
      { width: vw, height: vh },
      current.maxTop,
      current.minHeight
    );
    setPos({ x: next.x, y: next.y });
    setSize({ width: next.width, height: next.height });
    restore.current = next;
    if (persistKey && !saved) writeLayout(persistKey, next);
    setLayoutReady(true);
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [persistKey]);

  if (!open || !layoutReady) return null;

  function raise() {
    setZIndex((value) => (value >= 30 ? 21 : value + 1));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (maximized) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    raise();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPos({
      x: drag.current.originX + (event.clientX - drag.current.startX),
      y: drag.current.originY + (event.clientY - drag.current.startY),
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      persistLayout({
        x: drag.current.originX + (event.clientX - drag.current.startX),
        y: drag.current.originY + (event.clientY - drag.current.startY),
        width: size.width,
        height: minimized ? restore.current.height : size.height,
      });
    }
    drag.current = null;
    setInteracting(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function toggleMinimize() {
    if (minimized) {
      setMinimized(false);
      setSize((current) => ({
        ...current,
        height: Math.max(minHeight, restore.current.height),
      }));
      return;
    }
    if (maximized) {
      setMaximized(false);
      setPos({ x: restore.current.x, y: restore.current.y });
    } else {
      restore.current = { x: pos.x, y: pos.y, width: size.width, height: size.height };
    }
    setSize((current) => ({ ...current, height: minHeight }));
    setMinimized(true);
  }

  function toggleMaximize() {
    const wasMinimized = minimized;
    if (wasMinimized) setMinimized(false);
    if (maximized) {
      setMaximized(false);
      setPos({ x: restore.current.x, y: restore.current.y });
      setSize({ width: restore.current.width, height: restore.current.height });
      return;
    }
    if (!wasMinimized) {
      restore.current = { x: pos.x, y: pos.y, width: size.width, height: size.height };
    }
    setMaximized(true);
  }

  function onResizeDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
    resize.current = {
      startX: event.clientX,
      startY: event.clientY,
      originW: size.width,
      originH: size.height,
    };
    raise();
  }

  function onResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!resize.current) return;
    const maxW = viewport.width - pos.x - VIEW_PAD;
    const maxH = viewport.height - pos.y - VIEW_PAD;
    const nextHeight = Math.min(maxH, Math.max(minHeight, resize.current.originH + (event.clientY - resize.current.startY)));
    setMinimized(nextHeight < minHeight + LIBRARY_SPACE);
    setSize({
      width: Math.min(maxW, Math.max(MIN_WIDTH, resize.current.originW + (event.clientX - resize.current.startX))),
      height: nextHeight,
    });
  }

  function onResizeUp(event: React.PointerEvent<HTMLDivElement>) {
    if (resize.current) {
      const maxW = viewport.width - pos.x - VIEW_PAD;
      const maxH = viewport.height - pos.y - VIEW_PAD;
      persistLayout({
        x: pos.x,
        y: pos.y,
        width: Math.min(maxW, Math.max(MIN_WIDTH, resize.current.originW + (event.clientX - resize.current.startX))),
        height: Math.min(maxH, Math.max(minHeight, resize.current.originH + (event.clientY - resize.current.startY))),
      });
    }
    resize.current = null;
    setInteracting(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const compact = minimized || (!maximized && !hugContent && size.height < minHeight + LIBRARY_SPACE);
  const hug = hugContent || compact || minimized;

  const left = maximized ? VIEW_PAD : pos.x;
  const top = maximized ? maxTop : pos.y;
  const width = maximized ? viewport.width - VIEW_PAD * 2 : resizable ? size.width : undefined;
  const height = maximized
    ? viewport.height - maxTop - VIEW_PAD
    : resizable
      ? hug
        ? "auto"
        : size.height
      : undefined;

  const windowButton =
    "text-white hover:bg-white/15 hover:text-white";

  return (
    <div
      className={cn(
        "glass-window group/window fixed flex flex-col overflow-hidden rounded-xl",
        interacting && "is-dragging",
        !interacting && "window-size-motion",
        widthClassName,
        className
      )}
      data-compact={compact ? "true" : "false"}
      style={{ left, top, zIndex, width, height }}
      onPointerDown={raise}
    >
      <div
        className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-white/20 px-3 select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => {
          if (resizable) toggleMaximize();
        }}
      >
        <GripHorizontal className="size-4 opacity-80" />
        <span className="flex-1 truncate text-xs font-medium tracking-wide">{title}</span>
        <div className="flex items-center" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          {resizable ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={windowButton}
                title={minimized ? "Restore" : "Minimize"}
                aria-label={minimized ? "Restore" : "Minimize"}
                onClick={toggleMinimize}
              >
                <Minus />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={windowButton}
                title={maximized ? "Restore" : "Maximize"}
                aria-label={maximized ? "Restore" : "Maximize"}
                onClick={toggleMaximize}
              >
                {maximized ? <Minimize2 /> : <Maximize2 />}
              </Button>
            </>
          ) : null}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={windowButton}
              title="Close"
              aria-label="Close"
              onClick={onClose}
            >
              <X />
            </Button>
          ) : null}
        </div>
      </div>
      <div className={cn("overflow-hidden", hug ? "shrink-0" : "min-h-0 flex-1")}>
        <HugContentContext.Provider value={setHugContent}>
          <WindowCompactContext.Provider value={compact}>{children}</WindowCompactContext.Provider>
        </HugContentContext.Provider>
      </div>
      {resizable && !maximized ? (
        <div
          className="absolute right-0 bottom-0 z-10 size-5 cursor-se-resize"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          title="Resize"
        />
      ) : null}
    </div>
  );
}
