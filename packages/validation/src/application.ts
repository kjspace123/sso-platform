import { z } from 'zod';

const uriSchema = z
  .string()
  .url('Must be a valid absolute URI')
  .refine((uri) => !uri.includes('#'), 'Redirect URIs must not contain a fragment')
  .refine((uri) => {
    const parsed = new URL(uri);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password;
  }, 'Redirect URIs must use HTTP(S) and must not contain credentials')
  .refine((uri) => {
    const parsed = new URL(uri);
    const developmentHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname.endsWith('.localhost') ||
      parsed.hostname.endsWith('.test') ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]';
    return parsed.protocol === 'https:' || developmentHost;
  }, 'HTTP redirect URIs are only allowed for loopback, localhost, or reserved .test development hosts');

const uniqueUris = z.array(uriSchema).refine((uris) => new Set(uris).size === uris.length, 'Redirect URIs must be unique');
const requiredUniqueUris = z
  .array(uriSchema)
  .min(1, 'At least one redirect URI is required')
  .refine((uris) => new Set(uris).size === uris.length, 'Redirect URIs must be unique');

export const createApplicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['CONFIDENTIAL', 'PUBLIC']),
  redirectUris: requiredUniqueUris,
  postLogoutRedirectUris: uniqueUris.default([]),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const updateApplicationSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  redirectUris: requiredUniqueUris.optional(),
  postLogoutRedirectUris: uniqueUris.optional(),
});
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
