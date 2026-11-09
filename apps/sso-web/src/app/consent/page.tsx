"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { buttonClassName } from "@/components/form-field";
import { apiFetch, ApiError } from "@/lib/api";

interface InteractionDetails {
  uid: string;
  prompt: { name: string; details: { missingOIDCScope?: string[] } };
  params: { scope?: string };
  client?: { name: string };
}

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm your identity",
  email: "View your email address",
  offline_access: "Stay signed in when you're not active (offline access)",
};

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentContent />
    </Suspense>
  );
}

function ConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("interaction");
  const [interaction, setInteraction] = useState<InteractionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    apiFetch<InteractionDetails>(`/oidc/interaction/${uid}`)
      .then(setInteraction)
      .catch(() => router.replace("/error?error=invalid_request&error_description=This+request+has+expired."));
  }, [uid, router]);

  const respond = async (action: "confirm" | "abort") => {
    if (!uid) return;
    setSubmitting(true);
    try {
      const { redirectTo } = await apiFetch<{ redirectTo: string }>(`/oidc/interaction/${uid}/${action}`, {
        method: "POST",
      });
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  if (!uid) {
    return (
      <AuthCard title="Authorize application">
        <p className="text-sm text-neutral-500">This page is only reached as part of signing in to an application.</p>
      </AuthCard>
    );
  }

  if (!interaction) {
    return (
      <AuthCard title="Authorize application">
        <p className="text-sm text-neutral-500">Loading…</p>
      </AuthCard>
    );
  }

  const scopes = interaction.prompt.details.missingOIDCScope ?? interaction.params.scope?.split(" ") ?? [];
  const clientName = interaction.client?.name ?? "This application";

  return (
    <AuthCard title="Authorize application" description={`${clientName} would like to`}>
      <ul className="mb-6 space-y-2">
        {scopes.map((scope) => (
          <li key={scope} className="flex items-start gap-2 text-sm text-neutral-700">
            <span className="mt-0.5 text-neutral-400">•</span>
            {SCOPE_LABELS[scope] ?? scope}
          </li>
        ))}
      </ul>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => respond("abort")}
          disabled={submitting}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Deny
        </button>
        <button onClick={() => respond("confirm")} disabled={submitting} className={`flex-1 ${buttonClassName}`}>
          {submitting ? "Please wait…" : "Allow"}
        </button>
      </div>
    </AuthCard>
  );
}
