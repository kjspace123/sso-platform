"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicRole, PublicUser } from "@sso-platform/types";
import { apiFetch, ApiError } from "@/lib/api";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => apiFetch<PublicUser>(`/admin/users/${id}`),
  });
  const { data: roles } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => apiFetch<PublicRole[]>("/admin/roles"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "users", id] });

  const toggleStatus = async () => {
    if (!user) return;
    const action = user.status === "ACTIVE" ? "disable" : "enable";
    await apiFetch(`/admin/users/${id}/${action}`, { method: "POST" });
    invalidate();
  };

  const revokeSessions = async () => {
    await apiFetch(`/admin/users/${id}/revoke-sessions`, { method: "POST" });
  };

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error || !user) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof ApiError && error.statusCode === 404 ? "User not found." : "Could not load user."}
      </p>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <button onClick={() => router.push("/users")} className="text-sm text-neutral-500 hover:underline">
        ← Back to users
      </button>
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
          <dt className="text-neutral-500">Email</dt>
          <dd className="font-medium">{user.email}{user.pendingEmail && <span className="mt-1 block text-xs text-amber-800">Awaiting verification: {user.pendingEmail}</span>}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd>{user.status}</dd>
          <dt className="text-neutral-500">Roles</dt>
          <dd>{user.roles.join(", ") || "—"}</dd>
          <dt className="text-neutral-500">Email verified</dt>
          <dd>{user.emailVerified ? "Yes" : "No"}</dd>
          <dt className="text-neutral-500">Created</dt>
          <dd>{new Date(user.createdAt).toLocaleString()}</dd>
          <dt className="text-neutral-500">Last login</dt>
          <dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</dd>
        </dl>
      </div>
      {roles && <RoleEditor key={user.updatedAt} user={user} roles={roles} onSaved={invalidate} />}
      <div className="flex gap-3">
        <button
          onClick={toggleStatus}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
        >
          {user.status === "ACTIVE" ? "Disable account" : "Enable account"}
        </button>
        <button
          onClick={revokeSessions}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Revoke all sessions
        </button>
      </div>
    </div>
  );
}

function RoleEditor({ user, roles, onSaved }: { user: PublicUser; roles: PublicRole[]; onSaved: () => void }) {
  const [selected, setSelected] = useState(() => new Set(user.roles));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const toggle = (roleName: string) => {
    setStatus("idle");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(roleName)) next.delete(roleName);
      else next.add(roleName);
      return next;
    });
  };

  const save = async () => {
    setStatus("saving");
    try {
      await apiFetch(`/admin/users/${user.id}/roles`, {
        method: "PUT",
        body: JSON.stringify({ roleIds: roles.filter((role) => selected.has(role.name)).map((role) => role.id) }),
      });
      setStatus("saved");
      onSaved();
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-3 text-sm font-semibold">Assigned roles</h2>
      <div className="grid grid-cols-2 gap-2">
        {roles.map((role) => (
          <label key={role.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.has(role.name)} onChange={() => toggle(role.name)} />
            {role.name}
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={status === "saving"}
        className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : "Save roles"}
      </button>
      {status === "saved" && <span className="ml-3 text-sm text-green-700">Saved.</span>}
      {status === "error" && <span className="ml-3 text-sm text-red-600">Could not update roles.</span>}
    </div>
  );
}
