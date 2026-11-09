# NestJS API + OIDC provider — built from the monorepo root so pnpm workspace
# packages (@sso-platform/types, /validation, /config) resolve correctly.
FROM node:22-alpine AS base
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
RUN pnpm --filter @sso-platform/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
