"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicApplication } from "@sso-platform/types";
import { apiFetch, ApiError } from "@/lib/api";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);

  const { data: app, isLoading, error } = useQuery({
    queryKey: ["admin", "applications", id],
    queryFn: () => apiFetch<PublicApplication>(`/admin/applications/${id}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "applications", id] });

  const disable = async () => {
    await apiFetch(`/admin/applications/${id}/disable`, { method: "POST" });
    invalidate();
  };

  const rotateSecret = async () => {
    const { clientSecret } = await apiFetch<{ clientSecret: string }>(`/admin/applications/${id}/rotate-secret`, {
      method: "POST",
    });
    setRotatedSecret(clientSecret);
  };

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error || !app) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof ApiError && error.statusCode === 404 ? "Application not found." : "Could not load application."}
      </p>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <button onClick={() => router.push("/applications")} className="text-sm text-neutral-500 hover:underline">
        ← Back to applications
      </button>

      {rotatedSecret && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">New client secret — copy it now, it won&apos;t be shown again:</p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-xs">{rotatedSecret}</code>
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <dl className="grid grid-cols-[160px_1fr] gap-y-3 text-sm">
          <dt className="text-neutral-500">Name</dt>
          <dd className="font-medium">{app.name}</dd>
          <dt className="text-neutral-500">Client ID</dt>
          <dd className="font-mono text-xs">{app.clientId}</dd>
          <dt className="text-neutral-500">Type</dt>
          <dd>{app.type}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd>{app.status}</dd>
          <dt className="text-neutral-500">Redirect URIs</dt>
          <dd>
            <ul className="space-y-1">
              {app.redirectUris.map((uri) => (
                <li key={uri} className="font-mono text-xs">
                  {uri}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </div>

      <div className="flex gap-3">
        <button
          onClick={rotateSecret}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
        >
          Rotate client secret
        </button>
        {app.status === "ACTIVE" && (
          <button
            onClick={disable}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Disable application
          </button>
        )}
      </div>
    </div>
  );
}
