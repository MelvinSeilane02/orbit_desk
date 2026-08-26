"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** A title that truncates with an ellipsis when it doesn't fit its flex
 * slot — mainly mobile list rows, where secondary columns get hidden and
 * the title has to share space with a status tag/price. Hovering the text
 * shows the full value via the native `title` attribute; since touch
 * devices have no hover, a small "i" icon appears whenever the text is
 * actually truncated so a tap can reveal the same full value in a small
 * popover instead. */
export function TruncatedTitle({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintPos, setHintPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function check() {
      const el = textRef.current;
      if (el) setTruncated(el.scrollWidth > el.clientWidth + 1);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  useEffect(() => {
    if (!hintOpen) return;
    function close() {
      setHintOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [hintOpen]);

  function toggleHint(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setHintPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 24) });
    setHintOpen((v) => !v);
  }

  return (
    <span className="flex items-center gap-[4px]" style={style}>
      <span ref={textRef} title={text} className={`od-truncate ${className ?? ""}`} style={{ flex: 1, minWidth: 0 }}>
        {text}
      </span>
      {truncated && (
        <button ref={btnRef} type="button" onClick={toggleHint} aria-label={`Show full title: ${text}`} className="od-title-hint-btn">
          i
        </button>
      )}
      {truncated &&
        mounted &&
        hintOpen &&
        hintPos &&
        createPortal(
          <span className="od-title-hint-pop" style={{ top: hintPos.top, left: hintPos.left }} onClick={(e) => e.stopPropagation()}>
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}
