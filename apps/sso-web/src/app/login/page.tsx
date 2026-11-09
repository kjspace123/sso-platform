"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@sso-platform/validation";
import { AuthCard } from "@/components/auth-card";
import { FormField, buttonClassName, inputClassName } from "@/components/form-field";
import { apiFetch, ApiError } from "@/lib/api";
import { resolveSafeReturnTo } from "@/lib/safe-return-to";

interface InteractionDetails {
  client?: { name: string };
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const interactionUid = searchParams.get("interaction");
  const [interaction, setInteraction] = useState<InteractionDetails | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // When arriving here via an OIDC /authorize redirect, show which
  // application the user is signing in to (section 19 Phase 4).
  useEffect(() => {
    if (!interactionUid) return;
    apiFetch<InteractionDetails>(`/oidc/interaction/${interactionUid}`)
      .then(setInteraction)
      .catch(() => router.replace("/error?error=invalid_request&error_description=This+sign-in+link+has+expired."));
  }, [interactionUid, router]);

  const onSubmit = async (data: LoginInput) => {
    try {
      if (interactionUid) {
        const { redirectTo } = await apiFetch<{ redirectTo: string }>(
          `/oidc/interaction/${interactionUid}/login`,
          { method: "POST", body: JSON.stringify(data) },
        );
        // A real browser navigation, not fetch — oidc-provider's resume
        // endpoint issues further redirects that can cross origins, all the
        // way to the client application's own redirect_uri.
        window.location.assign(redirectTo);
        return;
      }

      await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) });
      window.location.assign(resolveSafeReturnTo(searchParams.get("returnTo"), window.location.origin));
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Sign in failed" });
    }
  };

  return (
    <AuthCard
      title="Sign in"
      description={
        interactionUid
          ? interaction
            ? `Continue to ${interaction.client?.name ?? "the application"}`
            : "Loading…"
          : "Use your platform account to continue"
      }
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href={interactionUid ? `/register?interaction=${encodeURIComponent(interactionUid)}` : "/register"}
            className="font-medium text-neutral-900 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputClassName} {...register("email")} />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClassName}
            {...register("password")}
          />
        </FormField>
        <div className="flex justify-end text-sm">
          <Link href="/forgot-password" className="text-neutral-500 hover:text-neutral-900 hover:underline">
            Forgot password?
          </Link>
        </div>
        {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
        <button type="submit" className={buttonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
