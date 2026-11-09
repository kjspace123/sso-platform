"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateApplicationSchema, type UpdateApplicationInput } from "@sso-platform/validation";
import type { PublicApplication } from "@sso-platform/types";
import { apiFetch, ApiError } from "@/lib/api";
import { SecretReveal } from "@/components/secret-reveal";

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

  const enable = async () => {
    await apiFetch(`/admin/applications/${id}/enable`, { method: "POST" });
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

      {rotatedSecret && <SecretReveal label="New client secret" value={rotatedSecret} />}

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

      <ApplicationEditor key={app.updatedAt} application={app} onSaved={invalidate} />

      <div className="flex gap-3">
        {app.type === "CONFIDENTIAL" && (
          <button
            onClick={rotateSecret}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            Rotate client secret
          </button>
        )}
        {app.status === "ACTIVE" && (
          <button
            onClick={disable}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Disable application
          </button>
        )}
        {app.status === "DISABLED" && (
          <button
            onClick={enable}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50"
          >
            Enable application
          </button>
        )}
      </div>
    </div>
  );
}

function ApplicationEditor({
  application,
  onSaved,
}: {
  application: PublicApplication;
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateApplicationInput>({
    resolver: zodResolver(updateApplicationSchema),
    defaultValues: {
      name: application.name,
      redirectUris: application.redirectUris,
      postLogoutRedirectUris: application.postLogoutRedirectUris,
    },
  });

  // Textareas are one-URI-per-line for editing convenience; parsed into the
  // array shape the shared @sso-platform/validation schema expects so the
  // same URL/HTTPS/fragment/uniqueness rules the create form and the API
  // enforce also run here, client-side, before submit.
  const parseUris = (text: string) =>
    text
      .split("\n")
      .map((uri) => uri.trim())
      .filter(Boolean);

  const onSubmit = async (data: UpdateApplicationInput) => {
    setSaved(false);
    try {
      await apiFetch(`/admin/applications/${application.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not save configuration" });
    }
  };

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <h2 className="text-sm font-semibold">Edit configuration</h2>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <input {...register("name")} className="w-full rounded-md border px-3 py-2" />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Redirect URIs (one per line)</span>
        <textarea
          defaultValue={application.redirectUris.join("\n")}
          onChange={(event) => setValue("redirectUris", parseUris(event.target.value), { shouldValidate: false })}
          rows={3}
          className="w-full rounded-md border px-3 py-2 font-mono text-xs"
        />
        {errors.redirectUris && <p className="text-sm text-red-600">{errors.redirectUris.message as string}</p>}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Post-logout redirect URIs (one per line)</span>
        <textarea
          defaultValue={application.postLogoutRedirectUris.join("\n")}
          onChange={(event) =>
            setValue("postLogoutRedirectUris", parseUris(event.target.value), { shouldValidate: false })
          }
          rows={2}
          className="w-full rounded-md border px-3 py-2 font-mono text-xs"
        />
        {errors.postLogoutRedirectUris && (
          <p className="text-sm text-red-600">{errors.postLogoutRedirectUris.message as string}</p>
        )}
      </label>
      {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Save configuration"}
      </button>
      {saved && <span className="ml-3 text-sm text-green-700">Saved.</span>}
    </form>
  );
}
