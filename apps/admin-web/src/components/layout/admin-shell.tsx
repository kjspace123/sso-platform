"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { PublicUser } from "@sso-platform/types";
import { apiFetch, getSsoWebUrl } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/applications", label: "Applications" },
  { href: "/roles", label: "Roles" },
  { href: "/permissions", label: "Permissions" },
  { href: "/sessions", label: "Sessions" },
  { href: "/audit-logs", label: "Audit logs" },
  { href: "/security", label: "Security" },
];

/**
 * Every admin page is gated on a valid SSO session with at least one
 * admin-scoped permission (section 14) — the API still enforces this
 * per-endpoint, this is just so the shell doesn't render for a signed-out
 * or under-privileged visitor.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<PublicUser>("/users/me"),
  });

  const isAdmin = (user?.permissions.length ?? 0) > 0;

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      const returnTo = encodeURIComponent(window.location.href);
      // Cross-origin redirect to the SSO app, not an internal Next.js route —
      // router.push() can't navigate across origins.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `${getSsoWebUrl()}/login?returnTo=${returnTo}`;
    }
  }, [isLoading, isError, user]);

  if (isLoading || isError || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-neutral-500">
        Your account ({user.email}) does not have admin access.
      </div>
    );
  }

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${getSsoWebUrl()}/login`;
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white">
            SSO
          </div>
          <span className="text-sm font-semibold">Admin</span>
        </div>
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end border-b border-neutral-200 bg-white px-6 py-3">
          <span className="mr-4 text-sm text-neutral-500">{user.email}</span>
          <button onClick={logout} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
            Sign out
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
