"use client";

import { useQuery } from "@tanstack/react-query";
import type { Paginated, PublicApplication, PublicUser, PublicRole } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const users = useQuery({
    queryKey: ["admin", "users", { page: 1, pageSize: 1 }],
    queryFn: () => apiFetch<Paginated<PublicUser>>("/admin/users?page=1&pageSize=1"),
  });
  const applications = useQuery({
    queryKey: ["admin", "applications"],
    queryFn: () => apiFetch<PublicApplication[]>("/admin/applications"),
  });
  const roles = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => apiFetch<PublicRole[]>("/admin/roles"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Users" value={users.data?.total ?? "—"} />
        <StatCard label="Applications" value={applications.data?.length ?? "—"} />
        <StatCard label="Roles" value={roles.data?.length ?? "—"} />
      </div>
    </div>
  );
}
