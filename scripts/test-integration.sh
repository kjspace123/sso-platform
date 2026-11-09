#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_ENV=test
export DATABASE_URL=postgresql://sso:test-only@localhost:55434/sso_test
export REDIS_URL=redis://localhost:56381
export SSO_BASE_URL=http://localhost:3000 ADMIN_BASE_URL=http://localhost:3001
export DEMO_APP_A_BASE_URL=http://localhost:3002 DEMO_APP_B_BASE_URL=http://localhost:3003
export OIDC_ISSUER=http://localhost:4000
export COOKIE_SECRET=integration-only-cookie-secret-never-use-in-production
export CLIENT_SECRET_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
export API_RATE_LIMIT=2000 OIDC_RATE_LIMIT=2000
export SMTP_HOST='' SMTP_USER='' SMTP_PASSWORD='' SMTP_FROM='' OIDC_JWKS=''
export SEED_ADMIN_EMAIL='' SEED_ADMIN_PASSWORD=''
export SEED_DEMO_APP_A_CLIENT_ID='' SEED_DEMO_APP_B_CLIENT_ID=''
trap 'docker compose -p sso-security-tests -f compose.test.yaml down' EXIT
docker compose -p sso-security-tests -f compose.test.yaml up -d --wait
pnpm build:packages
pnpm prisma:generate
pnpm --filter @sso-platform/api exec prisma migrate deploy
pnpm --filter @sso-platform/api exec prisma db seed
pnpm --filter @sso-platform/api test:e2e
