import 'reflect-metadata';
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { loadEnv, type Env } from '@sso-platform/config';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';

/**
 * Boots a real Nest application — the actual AppModule, wired up exactly
 * the way configureApp (shared with main.ts) configures it — against
 * whatever DATABASE_URL/REDIS_URL apps/api/.env points at. Requires those
 * to be reachable (e.g. `docker compose up -d postgres redis` mapped to
 * their host ports) the same way running the app locally does.
 *
 * Does not call app.listen(); tests drive it via supertest against
 * app.getHttpServer().
 */
export async function createTestApp(): Promise<NestExpressApplication> {
  const env = loadEnv(process.env);
  if (env.NODE_ENV !== 'test' || !new URL(env.DATABASE_URL).pathname.endsWith('_test')) {
    throw new Error('Integration tests require NODE_ENV=test and a database ending in _test');
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  await configureApp(app, env);
  await app.init();
  return app;
}

export function trustedOrigin(env: Env): string {
  return new URL(env.SSO_BASE_URL).origin;
}
