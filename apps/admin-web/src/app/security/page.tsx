"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface SecurityStatus {
  environment: string;
  checks: { name: string; status: "pass" | "warn" | "fail" }[];
}

export default function SecurityPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "security"],
    queryFn: () => apiFetch<SecurityStatus>("/admin/security"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Security</h1>
        {data && <p className="text-sm text-neutral-500">Environment: {data.environment}</p>}
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load security status.</p>}
      {data && (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {data.checks.map((check) => (
            <li key={check.name} className="flex items-center justify-between p-4 text-sm">
              <span>{check.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  check.status === "pass"
                    ? "bg-green-100 text-green-700"
                    : check.status === "warn"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {check.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
