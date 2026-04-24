"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Align = "start" | "end" | "stretch";

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: Align;
  offset?: number;
  className?: string;
  zIndex?: number;
  children: React.ReactNode;
}

interface Position {
  top: number;
  left?: number;
  right?: number;
  width?: number;
}

export function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  align = "start",
  offset = 4,
  className = "",
  zIndex = 50,
  children,
}: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const top = r.bottom + offset;
      if (align === "stretch") {
        setPos({ top, left: r.left, width: r.width });
      } else if (align === "end") {
        setPos({ top, right: window.innerWidth - r.right });
      } else {
        setPos({ top, left: r.left });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, align, offset, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleDown);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        right: pos.right,
        width: pos.width,
        maxWidth: "calc(100vw - 16px)",
        zIndex,
      }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}
