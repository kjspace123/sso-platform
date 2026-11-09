"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConnectedApplication } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

export default function ConnectedApplicationsPage() {
  const queryClient = useQueryClient();
  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["connected-applications"],
    queryFn: () => apiFetch<ConnectedApplication[]>("/users/me/applications"),
  });

  const revoke = async (id: string) => {
    await apiFetch(`/users/me/applications/${id}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["connected-applications"] });
  };

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error || !applications) return <p className="text-sm text-red-600">Could not load connected applications.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Connected applications</h2>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {applications.map((application) => (
          <li key={application.id} className="flex items-center justify-between gap-4 p-4 text-sm">
            <div>
              <p className="font-medium">{application.name}</p>
              <p className="text-neutral-500">
                {application.scopes.join(", ") || "OpenID access"}
                {application.grantedAt ? ` · granted ${new Date(application.grantedAt).toLocaleString()}` : ""}
              </p>
            </div>
            <button onClick={() => revoke(application.id)} className="text-red-600 hover:underline">
              Revoke access
            </button>
          </li>
        ))}
        {applications.length === 0 && <li className="p-4 text-sm text-neutral-500">No connected applications.</li>}
      </ul>
    </div>
  );
}
