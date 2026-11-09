# Generic Next.js app image, reused for sso-web / admin-web / demo-app-a / demo-app-b.
# Build with: docker build -f docker/web.Dockerfile --build-arg APP=sso-web --build-arg PORT=3000 .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
ARG APP
ARG PORT=3000

FROM base AS deps
ARG APP
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/${APP}/package.json apps/${APP}/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/auth-client/package.json packages/auth-client/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile --filter @sso-platform/${APP}...

FROM deps AS build
ARG APP
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# they must be present here, not just at container runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SSO_WEB_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SSO_WEB_URL=${NEXT_PUBLIC_SSO_WEB_URL}
COPY packages ./packages
COPY apps/${APP} ./apps/${APP}
RUN pnpm --filter @sso-platform/${APP} build

FROM base AS runner
ARG APP
ARG PORT
ENV NODE_ENV=production
ENV PORT=${PORT}
# Next.js standalone output already contains a pruned node_modules + server.js.
COPY --from=build /repo/apps/${APP}/.next/standalone ./
COPY --from=build /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build /repo/apps/${APP}/public ./apps/${APP}/public

WORKDIR /repo/apps/${APP}
EXPOSE ${PORT}
CMD ["node", "server.js"]
