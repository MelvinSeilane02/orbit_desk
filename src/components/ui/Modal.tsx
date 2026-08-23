"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Modal({
  onClose,
  size = "sm",
  children,
}: {
  onClose: () => void;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  // `document` exists on the client even during the very first (hydration)
  // render, so checking `typeof document === "undefined"` there returns
  // false immediately — causing the client's first render to diverge from
  // the server's (which genuinely has no `document`) and breaking
  // hydration. Gating on a `mounted` flag set in an effect instead means
  // the client's first render still renders null, matching the server; the
  // portal only appears in a later, client-only re-render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="od-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`od-modal ${size === "md" ? "od-modal-md" : "od-modal-sm"}`}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="od-modal-head">
      <div className="flex flex-col gap-1">
        <h4>{title}</h4>
        {subtitle && <span className="od-muted text-[12px]">{subtitle}</span>}
      </div>
      <button type="button" className="od-modal-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}
