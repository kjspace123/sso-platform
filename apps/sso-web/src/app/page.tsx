import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">
        SSO
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Single Sign-On Platform</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        Centralized identity for every connected application. Sign in once, stay signed in everywhere.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
