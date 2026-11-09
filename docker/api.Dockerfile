# NestJS API + OIDC provider — built from the monorepo root so pnpm workspace
# packages (@sso-platform/types, /validation, /config) resolve correctly.
FROM node:22-alpine AS base
# Prisma's query/schema engine binaries link against libssl and can't detect
# an OpenSSL version to pick the right one on a bare Alpine image (which
# ships neither openssl nor libssl by default) — without this the engine
# fails at runtime with "Could not parse schema engine response" once it
# can't load its shared libraries.
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile --filter @sso-platform/api...

FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @sso-platform/api exec prisma generate
RUN pnpm --recursive --filter @sso-platform/api^... --if-present build
RUN pnpm --filter @sso-platform/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/packages ./packages
COPY --from=build --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
# ts-node (used by `prisma db seed`, see api-entrypoint.sh) resolves the
# nearest tsconfig.json for its compiler options — without it present here,
# it falls back to incompatible defaults (module: NodeNext with
# moduleResolution: Node) and fails to compile prisma/seed.ts at all.
COPY --from=build --chown=node:node /repo/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY docker/api-entrypoint.sh /usr/local/bin/sso-api-entrypoint
RUN chmod 755 /usr/local/bin/sso-api-entrypoint

WORKDIR /repo/apps/api
# Prisma's seed runner spawns `ts-node ...` by bare name (from package.json's
# "prisma.seed"), expecting it on PATH the way `pnpm exec`/`npm exec` would
# provide — which we no longer go through (see api-entrypoint.sh). Without
# this, `prisma db seed` fails with "spawn ts-node ENOENT".
ENV PATH="/repo/apps/api/node_modules/.bin:${PATH}"
EXPOSE 4000
# node:22-alpine ships an unprivileged `node` user (uid 1000) — run as that
# instead of root so a container-breakout bug doesn't hand over a root shell.
USER node
CMD ["sso-api-entrypoint"]
