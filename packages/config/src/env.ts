import { z } from 'zod';

/**
 * Backend environment schema. Mirrors section 24 of the implementation plan.
 * Fail fast at boot if anything required is missing or malformed —
 * never let an SSO provider start with an invalid config.
 */
const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // section 24 lists a single APP_BASE_URL; extended to one per demo app
  // since the plan calls for two independent consumer applications (section 6).
  SSO_BASE_URL: z.string().url(),
  ADMIN_BASE_URL: z.string().url(),
  DEMO_APP_A_BASE_URL: z.string().url(),
  DEMO_APP_B_BASE_URL: z.string().url(),

  OIDC_ISSUER: z.string().url(),
  // JSON-stringified private JWKS used to sign ID tokens (section 24). Optional
  // outside production — apps/api/src/oidc/jwks.ts generates an ephemeral
  // keypair for local dev so tokens just work, at the cost of invalidating
  // sessions/tokens on every restart. Generate a real one with:
  //   pnpm --filter @sso-platform/api exec tsx scripts/generate-jwks.ts
  OIDC_JWKS: z.string().optional(),
  // Base64, must decode to exactly 32 bytes (AES-256-GCM key) — encrypts
  // OAuth client secrets at rest (see ClientSecret.secretCiphertext).
  // Generate with: openssl rand -base64 32
  CLIENT_SECRET_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, {
      message: 'CLIENT_SECRET_ENCRYPTION_KEY must be base64 for exactly 32 bytes (openssl rand -base64 32)',
    }),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),

  ACCESS_TOKEN_TTL: z.coerce.number().int().default(900), // 15 minutes
  REFRESH_TOKEN_TTL: z.coerce.number().int().default(1209600), // 14 days

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.OIDC_JWKS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OIDC_JWKS'],
      message: 'OIDC_JWKS is required in production (no ephemeral dev keys)',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  return result.data;
}
