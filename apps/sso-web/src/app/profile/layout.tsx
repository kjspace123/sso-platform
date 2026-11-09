"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

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
