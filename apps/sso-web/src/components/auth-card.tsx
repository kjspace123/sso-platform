import type { ReactNode } from 'react';

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
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-b from-slate-100 to-white px-4 py-12 text-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-950 text-sm font-bold text-white shadow-md shadow-neutral-900/20">
            SSO
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">{title}</h1>
          {description && <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>}
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-950 shadow-xl shadow-neutral-900/5">
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-neutral-600">{footer}</div>}
      </div>
    </div>
  );
}
