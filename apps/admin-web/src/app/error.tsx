"use client";

import { useEffect } from "react";

/**
 * Root error boundary — without this, an uncaught render/data error in any
 * admin page falls through to Next.js's generic blank error screen instead
 * of a page that at least tells the operator what happened and offers a
 * retry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">
          An unexpected error occurred while loading this page. You can try again, or head back to the dashboard.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
