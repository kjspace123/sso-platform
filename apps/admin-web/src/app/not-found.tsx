/** Shown for any unmatched admin route. */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <a
        href="/dashboard"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Back to dashboard
      </a>
    </div>
  );
}
