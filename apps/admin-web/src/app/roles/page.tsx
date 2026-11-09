"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createRoleSchema, type CreateRoleInput } from "@sso-platform/validation";
import type { PublicRole } from "@sso-platform/types";
import { apiFetch, ApiError } from "@/lib/api";

export default function RolesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: roles, isLoading, error } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => apiFetch<PublicRole[]>("/admin/roles"),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { permissionIds: [] },
  });

  const onSubmit = async (data: CreateRoleInput) => {
    try {
      await apiFetch("/admin/roles", { method: "POST", body: JSON.stringify(data) });
      reset();
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not create role" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Roles</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          {showCreate ? "Cancel" : "New role"}
        </button>
      </div>

      {showCreate && (
        <form
          className="max-w-md space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <input
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              {...register("description")}
            />
          </div>
          {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating…" : "Create"}
          </button>
          <p className="text-xs text-neutral-500">Permissions can be assigned from the role detail page.</p>
        </form>
      )}

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load roles.</p>}
      {roles && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/roles/${role.id}`} className="font-medium text-neutral-900 hover:underline">
                      {role.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{role.description ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-500">{role.permissions.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
