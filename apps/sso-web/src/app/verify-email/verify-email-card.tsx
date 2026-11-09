'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { ApiError, apiFetch } from '@/lib/api';

type Status = 'idle' | 'verifying' | 'verified' | 'error';

export function VerifyEmailCard({ token }: { token?: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>();

  const verify = async () => {
    if (!token) return;
    setStatus('verifying');
    setError(undefined);
    try {
      await apiFetch('/auth/email-verification/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      window.history.replaceState({}, '', '/verify-email?verified=1');
      setStatus('verified');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Email verification failed');
      setStatus('error');
    }
  };

  if (!token) {
    return (
      <AuthCard
        title="Invalid verification link"
        description="This link does not contain a verification token."
      >
        <Link
          href="/profile"
          className="block text-center text-sm font-bold text-neutral-900 hover:underline"
        >
          Return to your account
        </Link>
      </AuthCard>
    );
  }

  if (status === 'verified') {
    return (
      <AuthCard
        title="Email verified"
        description="Your email address is now verified and ready to use."
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-800">
            ✓
          </div>
          <Link
            href="/profile"
            className="block rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
          >
            Continue to your account
          </Link>
          <Link
            href="/login"
            className="block text-sm font-semibold text-neutral-700 hover:underline"
          >
            Sign in if you verified from another browser
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify your email"
      description="Confirm that this email address belongs to you."
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-neutral-700">
          Verification links are single-use and expire after 24 hours. Select the button below to
          finish verification.
        </p>
        {status === 'error' && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        <button
          type="button"
          onClick={verify}
          disabled={status === 'verifying'}
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:bg-neutral-400"
        >
          {status === 'verifying' ? 'Verifying…' : 'Verify email address'}
        </button>
      </div>
    </AuthCard>
  );
}
