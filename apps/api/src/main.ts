import 'reflect-metadata';
// Loads apps/api/.env when present. In Docker, compose's `env_file` already
// populates process.env, and dotenv never overwrites existing values.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { loadEnv } from '@sso-platform/config';
import { AppModule } from './app.module';
import { OidcProviderService } from './oidc/oidc-provider.service';
import { createCsrfOriginCheck } from './common/middleware/csrf-origin-check';

async function bootstrap() {
  const env = loadEnv(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Security headers (section 16).
  app.use(helmet());
  app.use(cookieParser());

  const trustedFrontendOrigins = [env.SSO_BASE_URL, env.ADMIN_BASE_URL, env.DEMO_APP_A_BASE_URL, env.DEMO_APP_B_BASE_URL];

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
    const config = new DocumentBuilder()
      .setTitle('SSO Platform API')
      .setDescription('Authentication, RBAC, application, session, and audit APIs.')
      .setVersion('0.1.0')
      .addCookieAuth('sso_session')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(env.PORT);
  console.log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap();
