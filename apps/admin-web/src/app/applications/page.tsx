"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApplicationSchema, type CreateApplicationInput } from "@sso-platform/validation";
import type { PublicApplication } from "@sso-platform/types";
import { apiFetch, ApiError } from "@/lib/api";
import { SecretReveal } from "@/components/secret-reveal";

export default function ApplicationsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newSecret, setNewSecret] = useState<{ name: string; clientSecret: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["admin", "applications"],
    queryFn: () => apiFetch<PublicApplication[]>("/admin/applications"),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateApplicationInput>({
    resolver: zodResolver(createApplicationSchema),
    defaultValues: { type: "CONFIDENTIAL", redirectUris: [], postLogoutRedirectUris: [] },
  });

  const onSubmit = async (data: CreateApplicationInput) => {
    try {
      const created = await apiFetch<PublicApplication & { clientSecret?: string }>("/admin/applications", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setNewSecret(created.clientSecret ? { name: created.name, clientSecret: created.clientSecret } : null);
      reset();
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not create application" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Applications</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          {showCreate ? "Cancel" : "New application"}
        </button>
      </div>

      {newSecret && <SecretReveal label={`Client secret for ${newSecret.name}`} value={newSecret.clientSecret} />}

      {showCreate && (
        <form
          className="max-w-md space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm" {...register("type")}>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Redirect URI</label>
            <input
              placeholder="http://localhost:3002/callback"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              onChange={(e) => setValue("redirectUris", [e.target.value], { shouldValidate: false })}
            />
            {errors.redirectUris && <p className="text-sm text-red-600">{errors.redirectUris.message as string}</p>}
          </div>
          {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load applications.</p>}
      {applications && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Client ID</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/applications/${app.id}`} className="font-medium text-neutral-900 hover:underline">
                      {app.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">{app.clientId}</td>
                  <td className="px-4 py-2 text-neutral-500">{app.type}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        app.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {app.status}
                    </span>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No applications registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
