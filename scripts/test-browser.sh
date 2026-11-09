#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_ENV=test
export DATABASE_URL=postgresql://sso:test-only@localhost:55434/sso_test
export REDIS_URL=redis://localhost:56381
export SSO_BASE_URL=http://localhost:3000 ADMIN_BASE_URL=http://localhost:3001
export DEMO_APP_A_BASE_URL=http://localhost:3002 DEMO_APP_B_BASE_URL=http://localhost:3003
export OIDC_ISSUER=http://localhost:4000 OIDC_INTERNAL_URL=http://localhost:4000 PORT=4000
export NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SSO_WEB_URL=http://localhost:3000
export NEXT_PUBLIC_ALLOWED_RETURN_ORIGINS=http://localhost:3001
export COOKIE_SECRET=browser-only-cookie-secret-never-use-in-production
export CLIENT_SECRET_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
export SESSION_SECRET=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
export API_RATE_LIMIT=2000 OIDC_RATE_LIMIT=2000
export SMTP_HOST='' SMTP_USER='' SMTP_PASSWORD='' SMTP_FROM='' OIDC_JWKS=''
export SEED_ADMIN_EMAIL='' SEED_ADMIN_PASSWORD=''
export SEED_DEMO_APP_A_CLIENT_ID=browser-app-a SEED_DEMO_APP_A_CLIENT_SECRET=browser-only-a
export SEED_DEMO_APP_A_REDIRECT_URI=http://localhost:3002/callback SEED_DEMO_APP_A_POST_LOGOUT_URI=http://localhost:3002
export SEED_DEMO_APP_B_CLIENT_ID=browser-app-b SEED_DEMO_APP_B_CLIENT_SECRET=browser-only-b
export SEED_DEMO_APP_B_REDIRECT_URI=http://localhost:3003/callback SEED_DEMO_APP_B_POST_LOGOUT_URI=http://localhost:3003
trap 'docker compose -p sso-browser-tests -f compose.test.yaml down' EXIT
docker compose -p sso-browser-tests -f compose.test.yaml up -d --wait
pnpm prisma:generate
NODE_ENV=production pnpm build
pnpm --filter @sso-platform/api exec prisma migrate deploy
pnpm --filter @sso-platform/api exec prisma db seed
pnpm exec playwright test
