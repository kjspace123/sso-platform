import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { loadEnv } from '@sso-platform/config';
import { createTestApp, trustedOrigin } from './utils/test-app';
import { CookieJar } from './utils/cookies';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let origin: string;
  const email = `e2e-auth-${Date.now()}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-1!';

  beforeAll(async () => {
    app = await createTestApp();
    origin = trustedOrigin(loadEnv(process.env));
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new account and sets a session cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email, password })
      .expect(201);

    expect(new CookieJar().absorb(res).get('sso_session')).toBeDefined();
  });

  it('rejects register of the same email twice', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email, password })
      .expect(409);
  });

  it('rejects a state-changing request with no Origin header (CSRF mitigation)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(403);
  });

  it('rejects login with the wrong password without revealing whether the account exists', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email, password: 'incorrect-password' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: `nobody-${Date.now()}@example.com`, password })
      .expect(401);

    expect(wrongPassword.body.message).toEqual(unknownEmail.body.message);
  });

  it('logs in with correct credentials and resolves the profile via /users/me', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email, password })
      .expect(200);
    const cookie = new CookieJar().absorb(loginRes).get('sso_session');
    expect(cookie).toBeDefined();

    const meRes = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookie!)
      .expect(200);
    expect(meRes.body.email).toBe(email);
  });

  it('rejects /users/me with no session cookie at all', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('logout revokes the session immediately', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email, password })
      .expect(200);
    const cookie = new CookieJar().absorb(loginRes).get('sso_session')!;

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer()).get('/api/users/me').set('Cookie', cookie).expect(401);
  });
});
