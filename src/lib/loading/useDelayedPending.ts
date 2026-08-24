"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Implements the loading-animation system's minimum-display-time rule: a
 * loader only appears once `active` has held for `showDelayMs` (so fast
 * operations never flash one), and once shown it stays for at least
 * `minDurationMs` even if `active` flips false early (so it never tears
 * down mid-beat).
 */
export function useDelayedPending(
  active: boolean,
  { showDelayMs = 180, minDurationMs = 400 }: { showDelayMs?: number; minDurationMs?: number } = {}
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      const shownAt = shownAtRef.current;
      if (shownAt === null) return;
      const remaining = minDurationMs - (Date.now() - shownAt);
      if (remaining <= 0) {
        shownAtRef.current = null;
        setVisible(false);
        return;
      }
      const timer = setTimeout(() => {
        shownAtRef.current = null;
        setVisible(false);
      }, remaining);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      shownAtRef.current = Date.now();
      setVisible(true);
    }, showDelayMs);
    return () => clearTimeout(timer);
  }, [active, showDelayMs, minDurationMs]);

  return visible;
}
