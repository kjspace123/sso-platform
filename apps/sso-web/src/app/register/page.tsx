"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@sso-platform/validation";
import { AuthCard } from "@/components/auth-card";
import { FormField, buttonClassName, inputClassName } from "@/components/form-field";
import { apiFetch, ApiError } from "@/lib/api";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) });
      const returnTo = searchParams.get("returnTo") ?? "/profile";
      router.push(returnTo);
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Registration failed" });
    }
  };

  return (
    <AuthCard
      title="Create your account"
      description="One account for every connected application"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Sign in
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
            autoComplete="new-password"
            className={inputClassName}
            {...register("password")}
          />
        </FormField>
        {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
        <button type="submit" className={buttonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
