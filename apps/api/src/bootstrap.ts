import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from '@sso-platform/config';
import { OidcProviderService } from './oidc/oidc-provider.service';
import { createCsrfOriginCheck } from './common/middleware/csrf-origin-check';
import { buildOpenApiDocument } from './swagger';
import { RequestRateLimiter } from './security/request-rate-limiter';

/**
 * Everything main.ts does to a freshly-created Nest app between
 * NestFactory.create() and app.listen() — security headers, CORS/CSRF,
 * mounting the OIDC provider's own routes ahead of Nest's router, Swagger.
 * Extracted so e2e tests exercise this exact configuration (via
 * test/utils/test-app.ts) instead of a hand-maintained approximation that
 * could silently drift from what actually runs in production.
 *
 * Does NOT call app.listen() — main.ts does that itself; e2e tests instead
 * drive the app via supertest against app.getHttpServer().
 */
export async function configureApp(app: NestExpressApplication, env: Env): Promise<void> {
  // Without this, Nest never wires up SIGTERM/SIGINT listeners, so
  // PrismaService/Redis onModuleDestroy() hooks never run — a container
  // orchestrator's SIGTERM during a rolling deploy would hard-kill
  // in-flight requests and DB/Redis connections instead of draining them.
  app.enableShutdownHooks();

  // Trust only configured proxy addresses. Production pins the edge proxy IP;
  // other deployments must configure their actual load balancer addresses.
  app.set('trust proxy', env.TRUST_PROXY);

  // Security headers (section 16).
  app.use(helmet());
  app.use(cookieParser());

  const trustedFrontendOrigins = [
    env.SSO_BASE_URL,
    env.ADMIN_BASE_URL,
    env.DEMO_APP_A_BASE_URL,
    env.DEMO_APP_B_BASE_URL,
  ].map((url) => new URL(url).origin);

  // CORS allowlist — only the platform's own frontends may send credentialed
  // requests (section 16: "CORS allowlist").
  app.enableCors({
    origin: trustedFrontendOrigins,
    credentials: true,
  });

  // CSRF mitigation for our own cookie-authenticated /api/* controllers —
  // rejects state-changing requests whose Origin/Referer isn't one of the
  // platform's own frontends (section 16). Note: this also means Swagger's
  // "try it out" (below) can't exercise mutating endpoints, since it calls
  // from the API's own origin — expected, not a bug.
  app.use(app.get(RequestRateLimiter).middleware);
  app.use(createCsrfOriginCheck(trustedFrontendOrigins));

  // Only our own controllers live under /api — oidc-provider's routes
  // (/authorize, /token, /jwks, /.well-known/openid-configuration, etc.,
  // mounted below) are raw Express middleware and never see this prefix.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Protocol endpoints handled by the OIDC provider layer, not our own
  // controllers (section 17). oidc-provider is a Koa app — Koa never calls
  // Express's next(), it always fully handles (or 404s) whatever request
  // reaches it. Mounting its callback with a bare app.use() would therefore
  // swallow every request, including ones meant for Nest.
  //
  // Gate it to only the specific top-level paths it actually owns — and use
  // the no-path app.use(fn) form (not Express's app.use(path, fn), which
  // would strip the prefix from req.url before Koa ever sees it, breaking
  // oidc-provider's own internal route matching).
  // (Must happen before app.init()/app.listen() finalizes Nest's router.)
  const oidcProvider = await app.get(OidcProviderService).initialize();
  const oidcCallback = oidcProvider.callback();
  const oidcPathPrefixes = [
    '/authorize', // overridden from oidc-provider's default '/auth' — see OidcProviderService
    '/token',
    '/jwks',
    '/.well-known',
    '/session', // /session/end (RP-initiated logout)
    '/me', // userinfo
    '/reg',
    '/device',
    '/challenge',
    '/backchannel',
    '/request',
    '/credential',
  ];
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (oidcPathPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
      oidcCallback(req, res);
      return;
    }
    next();
  });

  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
  }
}
