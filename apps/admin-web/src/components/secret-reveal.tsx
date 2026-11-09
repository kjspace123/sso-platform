"use client";

import { useEffect, useState } from "react";

const DEFAULT_AUTO_HIDE_SECONDS = 60;

/**
 * Displays a secret that's shown exactly once (a freshly created or rotated
 * OAuth client secret) with a copy-to-clipboard control and an auto-hide
 * timer, so the plaintext value isn't left rendered on screen indefinitely
 * — e.g. on a shared screen or after the operator has stepped away — after
 * they've copied it, or forgotten to.
 */
export function SecretReveal({
  label,
  value,
  autoHideSeconds = DEFAULT_AUTO_HIDE_SECONDS,
}: {
  label: string;
  value: string;
  autoHideSeconds?: number;
}) {
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(autoHideSeconds);
  // Derived during render rather than tracked as its own state — avoids a
  // second effect just to sync "hidden" whenever the countdown reaches zero.
  const hidden = secondsLeft <= 0;

  useEffect(() => {
    if (hidden) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [hidden, secondsLeft]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the value is
      // still selectable/copyable by hand from the <code> block below.
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-900">{label} — copy it now, it won&apos;t be shown again:</p>
      {hidden ? (
        <div className="mt-2 flex items-center gap-2">
          <code className="block rounded bg-white px-2 py-1 text-xs text-neutral-400">•••• hidden ••••</code>
          <button
            type="button"
            onClick={() => setSecondsLeft(autoHideSeconds)}
            className="shrink-0 text-xs font-medium text-amber-900 hover:underline"
          >
            Show again
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <code className="block break-all rounded bg-white px-2 py-1 text-xs">{value}</code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded border border-amber-400 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-700">Automatically hidden in {secondsLeft}s.</p>
        </>
      )}
    </div>
  );
}
