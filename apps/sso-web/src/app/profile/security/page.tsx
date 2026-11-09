"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@sso-platform/validation";
import { FormField, buttonClassName, inputClassName } from "@/components/form-field";
import { apiFetch, ApiError } from "@/lib/api";

export default function SecurityPage() {
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async (data: ChangePasswordInput) => {
    setSuccess(false);
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(data) });
      reset();
      setSuccess(true);
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not change password" });
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold">Change password</h2>
      <form className="max-w-sm space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            className={inputClassName}
            {...register("currentPassword")}
          />
        </FormField>
        <FormField label="New password" htmlFor="newPassword" error={errors.newPassword?.message}>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            className={inputClassName}
            {...register("newPassword")}
          />
        </FormField>
        {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
        {success && <p className="text-sm text-green-700">Password updated.</p>}
        <button type="submit" className={buttonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
