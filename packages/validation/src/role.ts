import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  permissionIds: z.array(z.string()).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  permissionIds: z.array(z.string()).optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
