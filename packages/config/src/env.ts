import { z } from 'zod';

const optionalString = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());
const optionalPort = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().min(1).max(65535).optional(),
);
const optionalBoolean = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.union([z.boolean(), z.enum(['true', 'false'])]).optional().transform((value) => value === true || value === 'true'),
);

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
  TRUST_PROXY: z.string().default('loopback'),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  OIDC_RATE_LIMIT: z.coerce.number().int().positive().default(120),

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

  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900), // 15 minutes
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(1209600), // 14 days

  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: z.preprocess((value) => (value === '' ? undefined : value), z.string().email().optional()),
  SMTP_SECURE: optionalBoolean.default(false),

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
  if (env.NODE_ENV === 'production') {
    for (const key of ['SSO_BASE_URL', 'ADMIN_BASE_URL', 'DEMO_APP_A_BASE_URL', 'DEMO_APP_B_BASE_URL', 'OIDC_ISSUER'] as const) {
      if (new URL(env[key]).protocol !== 'https:') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} must use HTTPS in production` });
      }
    }
    for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production for password reset delivery`,
        });
      }
    }
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
