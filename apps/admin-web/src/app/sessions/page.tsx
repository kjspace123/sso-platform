"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Paginated, PublicSession } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

const PAGE_SIZE = 25;

export default function SessionsPage() {
  const [page, setPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(true);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "sessions", page, activeOnly],
    queryFn: () =>
      apiFetch<Paginated<PublicSession>>(
        `/admin/sessions?page=${page}&pageSize=${PAGE_SIZE}&activeOnly=${activeOnly}`,
      ),
  });

  const revoke = async (id: string) => {
    await apiFetch(`/admin/sessions/${id}/revoke`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Sessions</h1>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => {
              setActiveOnly(e.target.checked);
              setPage(1);
            }}
          />
          Active only
        </label>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load sessions.</p>}
      {data && (
        <>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Device / IP</th>
                  <th className="px-4 py-2 font-medium">Last seen</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.items.map((session) => {
                  const isActive = !session.revokedAt && new Date(session.expiresAt) > new Date();
                  return (
                    <tr key={session.id}>
                      <td className="px-4 py-2">{session.userEmail ?? session.userId}</td>
                      <td className="px-4 py-2 text-neutral-500">
                        {session.deviceName ?? session.userAgent ?? "Unknown device"} ·{" "}
                        {session.ipAddress ?? "Unknown IP"}
                      </td>
                      <td className="px-4 py-2 text-neutral-500">{new Date(session.lastSeenAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {isActive ? "Active" : session.revokedAt ? "Revoked" : "Expired"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {isActive && (
                          <button onClick={() => revoke(session.id)} className="text-sm text-red-600 hover:underline">
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      No sessions found.
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
