"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { PublicUser } from "@sso-platform/types";
import { apiFetch } from "@/lib/api";

const TABS = [
  { href: "/profile", label: "Profile" },
  { href: "/profile/security", label: "Security" },
  { href: "/profile/sessions", label: "Sessions" },
  { href: "/profile/applications", label: "Applications" },
];

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Gate every /profile/* route on a valid session — the API still enforces
  // this per-endpoint, this is just so an unauthenticated visitor is sent to
  // sign in instead of seeing "Are you signed in?" text on every tab.
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<PublicUser>("/users/me"),
  });

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isError, user, pathname, router]);

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

  if (isLoading || isError || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Your account</h1>
        <button
          onClick={logout}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
        >
          Sign out
        </button>
      </div>
      <nav className="mb-8 flex gap-1 border-b border-neutral-200">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              pathname === tab.href
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
