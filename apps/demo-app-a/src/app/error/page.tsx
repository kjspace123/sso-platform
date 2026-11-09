import Link from "next/link";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { error, error_description: description } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-50 px-4 text-center">
      <h1 className="text-xl font-semibold text-blue-950">Sign-in failed</h1>
      <p className="max-w-sm text-sm text-blue-900/70">{description ?? "Something went wrong."}</p>
      {error && <code className="rounded bg-white px-2 py-1 text-xs text-blue-900/70">{error}</code>}
      <Link href="/" className="mt-4 text-sm font-medium text-blue-700 hover:underline">
        Back to Demo App A
      </Link>
    </div>
  );
}
