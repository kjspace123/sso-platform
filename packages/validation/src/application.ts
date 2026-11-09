import { z } from 'zod';

const uriSchema = z
  .string()
  .url('Must be a valid absolute URI')
  .refine((uri) => !uri.includes('#'), 'Redirect URIs must not contain a fragment');

export const createApplicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['CONFIDENTIAL', 'PUBLIC']),
  redirectUris: z.array(uriSchema).min(1, 'At least one redirect URI is required'),
  postLogoutRedirectUris: z.array(uriSchema).default([]),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const updateApplicationSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  redirectUris: z.array(uriSchema).min(1).optional(),
  postLogoutRedirectUris: z.array(uriSchema).optional(),
});
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
