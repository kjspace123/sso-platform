"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Paginated, PublicUser } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

const PAGE_SIZE = 50;

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users", { page, pageSize: PAGE_SIZE, search }],
    queryFn: () =>
      apiFetch<Paginated<PublicUser>>(
        `/admin/users?page=${page}&pageSize=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Users</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by email…"
          className="w-64 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load users.</p>}
      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Roles</th>
                  <th className="px-4 py-2 font-medium">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <Link href={`/users/${user.id}`} className="font-medium text-neutral-900 hover:underline">
                        {user.email}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{user.roles.join(", ") || "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                      {search ? "No users match your search." : "No users yet."}
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
