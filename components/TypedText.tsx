"use client";

import { useEffect, useState } from "react";

/**
 * Reveals `text` character-by-character at a fixed rate.
 * Resets when the text identity changes.
 */
export default function TypedText({
  text,
  cps = 38,
  className,
}: {
  text: string;
  cps?: number;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    if (!text) return;
    const interval = 1000 / Math.max(1, cps);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= text.length) window.clearInterval(id);
    }, interval);
    return () => window.clearInterval(id);
  }, [text, cps]);

  const shown = text.slice(0, revealed);
  const done = revealed >= text.length;

  return (
    <span className={className}>
      {shown}
      {!done && <span className="inline-block w-[1ch] animate-pulse">▍</span>}
    </span>
  );
}
