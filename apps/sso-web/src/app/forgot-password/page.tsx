"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@sso-platform/validation";
import { AuthCard } from "@/components/auth-card";
import { FormField, buttonClassName, inputClassName } from "@/components/form-field";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordInput) => {
    // Always shows the same confirmation regardless of whether the account
    // exists — the API behaves identically either way (section 16).
    await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify(data) }).catch(() => {});
    setSubmitted(true);
  };

  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link if an account exists"
      footer={
        <Link href="/login" className="font-medium text-neutral-900 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {submitted ? (
        <p className="text-sm text-neutral-600">
          If an account exists for that email, a password reset link is on its way.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" autoComplete="email" className={inputClassName} {...register("email")} />
          </FormField>
          <button type="submit" className={buttonClassName} disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
