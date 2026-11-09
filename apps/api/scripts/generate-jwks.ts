/**
 * Generates a persistent private JWKS for signing OIDC ID tokens and prints
 * it as a single JSON line, ready to paste into OIDC_JWKS.
 *
 * Usage: pnpm --filter @sso-platform/api exec ts-node --transpile-only scripts/generate-jwks.ts
 */
import { exportJWK, generateKeyPair } from 'jose';
import { randomUUID } from 'node:crypto';

async function main() {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(privateKey);
  const jwks = { keys: [{ ...jwk, alg: 'RS256', use: 'sig', kid: randomUUID() }] };
  console.log(JSON.stringify(jwks));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
