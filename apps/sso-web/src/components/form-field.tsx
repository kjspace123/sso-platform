import type { ReactNode } from 'react';

export function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export const inputClassName =
  'block min-h-11 w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm placeholder:text-neutral-500 focus:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-800/20';

export const buttonClassName =
  'flex min-h-11 w-full items-center justify-center rounded-lg bg-neutral-950 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400 disabled:text-white';
