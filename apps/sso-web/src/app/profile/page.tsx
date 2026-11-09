"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicUser } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

export default function ProfilePage() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<PublicUser>("/users/me"),
  });

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error || !user) return <p className="text-sm text-red-600">Could not load your profile. Are you signed in?</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <dt className="text-neutral-500">Email</dt>
          <dd className="font-medium">{user.email}</dd>

          <dt className="text-neutral-500">Status</dt>
          <dd>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                user.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              {user.status}
            </span>
          </dd>

          <dt className="text-neutral-500">Email verified</dt>
          <dd>{user.emailVerified ? "Yes" : "No"}</dd>

          <dt className="text-neutral-500">Roles</dt>
          <dd>{user.roles.length > 0 ? user.roles.join(", ") : "—"}</dd>

          <dt className="text-neutral-500">Last login</dt>
          <dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</dd>
        </dl>
      </div>
    </div>
  );
}
