# API reference

`openapi.json` is a static export of the API's OpenAPI 3 spec. It exists
because the live Swagger UI (`/docs`) is intentionally disabled when
`NODE_ENV=production` (see `apps/api/src/main.ts`) — this is how the
authentication/RBAC/application/session/audit API contract gets published
to integrators without exposing an interactive endpoint in production.

## Regenerating

```sh
pnpm --filter @sso-platform/api export-openapi
```

Requires a reachable `DATABASE_URL`/`REDIS_URL` (same as running the app —
it boots the full module graph to introspect controllers, it just never
calls `app.listen()`). Regenerate and commit whenever routes, DTOs, or
response shapes change.
