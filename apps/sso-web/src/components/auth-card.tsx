import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">
            SSO
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-neutral-500">{footer}</div>}
      </div>
    </div>
  );
}
