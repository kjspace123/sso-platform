"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Paginated, PublicAuditLog } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

const PAGE_SIZE = 25;

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "audit-logs", page],
    queryFn: () => apiFetch<Paginated<PublicAuditLog>>(`/admin/audit-logs?page=${page}&pageSize=${PAGE_SIZE}`),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Audit logs</h1>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load audit logs.</p>}
      {data && (
        <>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Resource</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {log.resourceType ? `${log.resourceType}${log.resourceId ? ` · ${log.resourceId}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-500">{log.actorId ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{log.ipAddress ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      No audit events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-neutral-500">
            <span>
              Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))} ({data.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page * PAGE_SIZE >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
