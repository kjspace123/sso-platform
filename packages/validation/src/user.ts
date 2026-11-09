import { z } from 'zod';

export const updateProfileSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const listUsersSchema = paginationSchema.extend({
  // Case-insensitive substring match on email — lets an operator find a
  // specific user instead of paging through every account.
  search: z.string().trim().min(1).max(200).optional(),
});
export type ListUsersInput = z.infer<typeof listUsersSchema>;
