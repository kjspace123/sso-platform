"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicPermission } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

export default function PermissionsPage() {
  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiFetch<PublicPermission[]>("/admin/permissions"),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Permissions</h1>
      <p className="text-sm text-neutral-500">
        Permissions are seeded from the codebase (prisma/seed.ts) rather than managed here — they map directly to
        `@RequirePermission()` checks in the API.
      </p>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load permissions.</p>}
      {permissions && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {permissions.map((permission) => (
                <tr key={permission.id}>
                  <td className="px-4 py-2 font-mono text-xs">{permission.name}</td>
                  <td className="px-4 py-2 text-neutral-500">{permission.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
