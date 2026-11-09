'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@sso-platform/types';
import { updateProfileSchema, type UpdateProfileInput } from '@sso-platform/validation';
import { apiFetch, ApiError } from '@/lib/api';
import { FormField, buttonClassName, inputClassName } from '@/components/form-field';

export default function ProfilePage() {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<PublicUser>('/users/me'),
  });

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error || !user)
    return <p className="text-sm text-red-600">Could not load your profile. Are you signed in?</p>;

  return (
    <div className="space-y-6">
      {(!user.emailVerified || user.pendingEmail) && <EmailVerificationCard email={user.pendingEmail ?? user.email} />}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <dt className="text-neutral-500">Email</dt>
          <dd className="font-medium">{user.email}{user.pendingEmail && <span className="mt-1 block text-xs text-amber-800">Awaiting verification: {user.pendingEmail}</span>}</dd>

          <dt className="text-neutral-500">Status</dt>
          <dd>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                user.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {user.status}
            </span>
          </dd>

          <dt className="text-neutral-500">Email verified</dt>
          <dd>{user.emailVerified ? 'Yes' : 'No'}</dd>

          <dt className="text-neutral-500">Roles</dt>
          <dd>{user.roles.length > 0 ? user.roles.join(', ') : '—'}</dd>

          <dt className="text-neutral-500">Last login</dt>
          <dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}</dd>
        </dl>
      </div>
      <ProfileEditor key={user.updatedAt} user={user} />
    </div>
  );
}

function EmailVerificationCard({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string>();

  const resend = async () => {
    setStatus('sending');
    setMessage(undefined);
    try {
      await apiFetch('/auth/email-verification/resend', { method: 'POST' });
      setStatus('sent');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Could not send verification email');
      setStatus('error');
    }
  };

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-sm font-bold">Verify your email address</h2>
      <p className="mt-1 text-sm leading-6 text-amber-900">
        Your email <strong>{email}</strong> is not verified. Request a single-use link that expires
        after 24 hours.
      </p>
      <button
        type="button"
        onClick={resend}
        disabled={status === 'sending' || status === 'sent'}
        className="mt-3 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-bold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === 'sending'
          ? 'Sending…'
          : status === 'sent'
            ? 'Verification email sent'
            : 'Resend email'}
      </button>
      {status === 'error' && <p className="mt-2 text-sm font-medium text-red-700">{message}</p>}
    </section>
  );
}

function ProfileEditor({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { email: user.pendingEmail ?? user.email },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    setSaved(false);
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
    } catch (error) {
      setError('root', {
        message: error instanceof ApiError ? error.message : 'Could not update profile',
      });
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold">Update profile</h2>
      <form className="max-w-sm space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClassName}
            {...register('email')}
          />
        </FormField>
        <p className="text-xs text-neutral-500">
          Your current address remains active for sign-in and recovery until you verify the new address.
        </p>
        {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
        {saved && <p className="text-sm text-green-700">Profile updated.</p>}
        <button type="submit" className={buttonClassName} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
