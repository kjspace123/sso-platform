import { Logger } from '@nestjs/common';
import { exportJWK, generateKeyPair } from 'jose';
import type { JWKS } from 'oidc-provider';
import type { Env } from '@sso-platform/config';

const logger = new Logger('OidcJwks');

/**
 * Loads the private JWKS used to sign ID tokens (section 19 Phase 4: "Configure
 * JWKS"). In production this must come from OIDC_JWKS (persisted — losing it
 * invalidates every issued token and breaks clients' cached verification
 * keys). Outside production, an ephemeral RSA keypair is generated at boot
 * so local dev works with zero setup; env.ts's superRefine already fails
 * fast if OIDC_JWKS is missing in production, so the ephemeral path here can
 * never accidentally run there.
 */
export async function loadJwks(env: Env): Promise<JWKS> {
  if (env.OIDC_JWKS) {
    const parsed: unknown = JSON.parse(env.OIDC_JWKS);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as JWKS).keys)) {
      throw new Error('OIDC_JWKS must be a JSON Web Key Set: {"keys": [...]}');
    }
    return parsed as JWKS;
  }

  logger.warn(
    'OIDC_JWKS not set — generating an ephemeral signing key for local development. ' +
      'Every restart invalidates existing tokens/sessions. Generate a real one with: ' +
      'pnpm --filter @sso-platform/api exec ts-node --transpile-only scripts/generate-jwks.ts',
  );
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(privateKey);
  return { keys: [{ ...jwk, alg: 'RS256', use: 'sig' }] };
}
