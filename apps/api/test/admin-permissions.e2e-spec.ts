import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { loadEnv } from '@sso-platform/config';
import { createTestApp, trustedOrigin } from './utils/test-app';
import { CookieJar } from './utils/cookies';

describe('Admin permission boundary (e2e)', () => {
  let app: NestExpressApplication;
  let origin: string;

  beforeAll(async () => {
    app = await createTestApp();
    origin = trustedOrigin(loadEnv(process.env));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request to an admin endpoint', async () => {
    await request(app.getHttpServer()).get('/api/admin/users').expect(401);
  });

  it('rejects a signed-in but non-admin (default role) user with 403, not 500 or a silent empty list', async () => {
    const email = `e2e-nonadmin-${Date.now()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple-1!';

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email, password })
      .expect(201);
    const cookie = new CookieJar().absorb(registerRes).get('sso_session')!;

    // A freshly registered account only ever gets the default 'user' role,
    // which carries none of the admin:* permissions — PermissionsGuard
    // (registered globally in app.module.ts) should reject this before the
    // controller/service ever runs.
    const res = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', cookie)
      .expect(403);
    expect(res.body.statusCode).toBe(403);
  });

  it('rejects the same non-admin user from every other admin resource too', async () => {
    const email = `e2e-nonadmin2-${Date.now()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple-1!';
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email, password })
      .expect(201);
    const cookie = new CookieJar().absorb(registerRes).get('sso_session')!;

    for (const path of ['/api/admin/applications', '/api/admin/roles', '/api/admin/audit-logs', '/api/admin/sessions']) {
      await request(app.getHttpServer()).get(path).set('Cookie', cookie).expect(403);
    }
  });
});
