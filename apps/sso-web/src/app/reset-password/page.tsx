"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@sso-platform/validation";
import { AuthCard } from "@/components/auth-card";
import { FormField, buttonClassName, inputClassName } from "@/components/form-field";
import { apiFetch, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify(data) });
      router.push("/login");
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Reset failed" });
    }
  };

  if (!token) {
    return (
      <AuthCard title="Reset your password">
        <p className="text-sm text-neutral-600">
          This reset link is missing its token. Request a new one from the{" "}
          <Link href="/forgot-password" className="font-medium text-neutral-900 hover:underline">
            forgot password
          </Link>{" "}
          page.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <input type="hidden" {...register("token")} />
        <FormField label="New password" htmlFor="password" error={errors.password?.message}>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClassName}
            {...register("password")}
          />
        </FormField>
        {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
        <button type="submit" className={buttonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}
