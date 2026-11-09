"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicPermission, PublicRole } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // No GET /admin/roles/:id endpoint yet — the list is small enough to fetch
  // and filter client-side rather than adding a single-role endpoint today.
  const { data: roles, isLoading } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => apiFetch<PublicRole[]>("/admin/roles"),
  });
  const { data: permissions } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiFetch<PublicPermission[]>("/admin/permissions"),
  });

  const role = roles?.find((r) => r.id === id);

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!role) return <p className="text-sm text-red-600">Role not found.</p>;

  return (
    <div className="max-w-xl space-y-6">
      <button onClick={() => router.push("/roles")} className="text-sm text-neutral-500 hover:underline">
        ← Back to roles
      </button>
      <div>
        <h1 className="text-lg font-semibold">{role.name}</h1>
        {role.description && <p className="text-sm text-neutral-500">{role.description}</p>}
      </div>

      {/* Keyed by role.id so the editor's local selection state re-initializes
          cleanly if the route ever navigates between two different roles. */}
      <PermissionEditor key={role.id} roleId={role.id} role={role} permissions={permissions ?? []} />
    </div>
  );
}

function PermissionEditor({
  roleId,
  role,
  permissions,
}: {
  roleId: string;
  role: PublicRole;
  permissions: PublicPermission[];
}) {
  const queryClient = useQueryClient();
  // Lazy-initialized straight from already-loaded data — no effect needed to
  // sync it in after the fact.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role.permissions));
  const [saved, setSaved] = useState(false);

  const toggle = (name: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const save = async () => {
    const permissionIds = permissions.filter((p) => selected.has(p.name)).map((p) => p.id);
    await apiFetch(`/admin/roles/${roleId}`, { method: "PATCH", body: JSON.stringify({ permissionIds }) });
    setSaved(true);
    queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">Permissions</h2>
      <div className="grid grid-cols-2 gap-2">
        {permissions.map((permission) => (
          <label key={permission.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.has(permission.name)} onChange={() => toggle(permission.name)} />
            <span className="font-mono text-xs">{permission.name}</span>
          </label>
        ))}
      </div>
      <button
        onClick={save}
        className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800"
      >
        Save permissions
      </button>
      {saved && <span className="ml-3 text-sm text-green-700">Saved.</span>}
    </div>
  );
}
