/** Root loading fallback shown while a route segment's data is fetching. */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
