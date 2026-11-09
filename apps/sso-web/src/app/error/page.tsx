"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";

export default function ErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}

function ErrorContent() {
  const searchParams = useSearchParams();
  // Standard OAuth 2.0 error query params (RFC 6749 §4.1.2.1) plus our own
  // human-readable fallback — this page is where /authorize redirects on
  // failures like an invalid redirect_uri, expired code, or denied consent.
  const error = searchParams.get("error") ?? "unexpected_error";
  const description = searchParams.get("error_description") ?? "Something went wrong while signing you in.";

  return (
    <AuthCard title="Something went wrong">
      <div className="space-y-4 text-sm">
        <p className="text-neutral-600">{description}</p>
        <p className="rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-500">{error}</p>
        <Link href="/login" className="block font-medium text-neutral-900 hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
