import Link from 'next/link';

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { error, error_description: description } = await searchParams;

  return (
    <main className="flex min-h-screen items-center bg-purple-50 px-5 py-12 text-purple-950">
      <section className="mx-auto w-full max-w-md rounded-3xl border border-purple-200 bg-white p-8 text-center shadow-xl shadow-purple-950/10">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl font-bold text-red-800"
          aria-hidden="true"
        >
          !
        </div>
        <h1 className="mt-5 text-2xl font-bold">Sign-in failed</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {description ?? 'Something went wrong.'}
        </p>
        {error && (
          <code className="mt-4 inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800">
            {error}
          </code>
        )}
        <Link
          href="/"
          className="mt-7 block rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-800"
        >
          Back to Demo App B
        </Link>
      </section>
    </main>
  );
}
