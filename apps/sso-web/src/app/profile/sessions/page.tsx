"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicSession } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiFetch<PublicSession[]>("/users/me/sessions"),
  });

  const revoke = async (id: string) => {
    await apiFetch(`/users/me/sessions/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const logoutAll = async () => {
    await apiFetch("/auth/logout-all", { method: "POST" });
    router.push("/login");
  };

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error || !sessions) return <p className="text-sm text-red-600">Could not load sessions.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Active sessions</h2>
        <button onClick={logoutAll} className="text-sm font-medium text-red-600 hover:underline">
          Log out of all devices
        </button>
      </div>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">
                {session.deviceName ?? session.userAgent ?? "Unknown device"}
                {session.current && (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                    This device
                  </span>
                )}
              </p>
              <p className="text-neutral-500">
                {session.ipAddress ?? "Unknown IP"} · last seen {new Date(session.lastSeenAt).toLocaleString()}
              </p>
            </div>
            {!session.current && (
              <button onClick={() => revoke(session.id)} className="text-sm text-red-600 hover:underline">
                Revoke
              </button>
            )}
          </li>
        ))}
        {sessions.length === 0 && <li className="p-4 text-sm text-neutral-500">No active sessions.</li>}
      </ul>
    </div>
  );
}
