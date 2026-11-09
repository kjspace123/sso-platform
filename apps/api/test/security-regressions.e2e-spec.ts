import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type Redis from 'ioredis';
import { loadEnv } from '@sso-platform/config';
import { createTestApp, trustedOrigin } from './utils/test-app';
import { CookieJar } from './utils/cookies';
import { PrismaService } from '../src/database/prisma.service';
import { REDIS } from '../src/database/redis.module';
import { PasswordService } from '../src/auth/password.service';
import { RedisAdapter } from '../src/oidc/redis-adapter';
import { EmailVerificationService } from '../src/email-verification/email-verification.service';
import { PasswordResetService } from '../src/password-reset/password-reset.service';
import { RequestRateLimiter } from '../src/security/request-rate-limiter';

describe('Security regressions (real PostgreSQL and Redis)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let origin: string;
  let adminCookie: string;
  let superCookie: string;
  let superId: string;
  const password = 'Correct-Horse-Battery-Staple-1!';
  const suffix = randomUUID();
  const superEmail = `super-${suffix}@example.com`;

  beforeAll(async () => {
    app = await createTestApp(); prisma = app.get(PrismaService); redis = app.get(REDIS);
    origin = trustedOrigin(loadEnv());
    const hash = await app.get(PasswordService).hash(password);
    for (const roleName of ['admin', 'super-admin']) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
      const email = roleName === 'admin' ? `operator-${suffix}@example.com` : superEmail;
      const user = await prisma.user.create({ data: {
        email, passwordHash: hash, emailVerified: true, roles: { create: { roleId: role.id } },
      } });
      const res = await request(app.getHttpServer()).post('/api/auth/login').set('Origin', origin)
        .send({ email, password }).expect(200);
      const cookie = new CookieJar().absorb(res).get('sso_session')!;
      if (roleName === 'admin') adminCookie = cookie;
      else { superCookie = cookie; superId = user.id; }
    }
  });
  afterAll(async () => { await app?.close(); });

  it('prevents the operational admin from changing a super-admin recovery address', async () => {
    await request(app.getHttpServer()).patch(`/api/admin/users/${superId}`).set('Origin', origin)
      .set('Cookie', adminCookie).send({ email: `attacker-${suffix}@example.com` }).expect(403);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: superId } });
    expect(user.email).toBe(superEmail); expect(user.pendingEmail).toBeNull();
  });

  it('does not authenticate a session ID returned by the session management API', async () => {
    const sessions = await request(app.getHttpServer()).get('/api/admin/sessions').set('Cookie', superCookie).expect(200);
    const session = sessions.body.items.find((s: { userId: string }) => s.userId === superId);
    expect(session).toBeDefined();
    expect(session).not.toHaveProperty('tokenHash'); expect(session).not.toHaveProperty('token');
    await request(app.getHttpServer()).get('/api/users/me').set('Cookie', `sso_session=${session.id}`).expect(401);
    await request(app.getHttpServer()).get('/api/users/me').set('Cookie', superCookie).expect(200);
  });

  it('keeps recovery on the old address until verification, then invalidates old reset links', async () => {
    const email = `replacement-${suffix}@example.com`;
    const resets = app.get(PasswordResetService);
    const previousReset = await resets.createToken(superId);
    await request(app.getHttpServer()).patch('/api/users/me').set('Origin', origin).set('Cookie', superCookie)
      .send({ email }).expect(200);
    const pending = await prisma.user.findUniqueOrThrow({ where: { id: superId } });
    expect(pending.email).toBe(superEmail); expect(pending.pendingEmail).toBe(email);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    const service = app.get(EmailVerificationService);
    const token = await service.issue(superId, email);
    await expect(service.consume(token)).resolves.toEqual({ userId: superId, email });
    const verified = await prisma.user.findUniqueOrThrow({ where: { id: superId } });
    expect(verified.email).toBe(email); expect(verified.pendingEmail).toBeNull(); expect(verified.emailVerified).toBe(true);
    await expect(resets.consume(previousReset)).resolves.toBeNull();
    await expect(service.consume(token)).resolves.toBeNull();
  });

  it.each(['AuthorizationCode', 'RefreshToken'])('allows exactly one concurrent consumption of %s', async (model) => {
    const id = randomUUID(); const grantId = randomUUID();
    const grants = new RedisAdapter('Grant', redis);
    const adapter = new RedisAdapter(model, redis);
    await grants.upsert(grantId, { accountId: superId }, 60);
    await adapter.upsert(id, { accountId: superId, grantId }, 60);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => adapter.consume(id)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await grants.find(grantId)).toBeUndefined();
  });

  it('does not recreate expired tokens and preserves the TTL of consumed tokens', async () => {
    const adapter = new RedisAdapter('AuthorizationCode', redis); const id = randomUUID();
    await expect(adapter.consume(id)).rejects.toMatchObject({ error: 'invalid_grant' });
    expect(await redis.exists(`oidc:AuthorizationCode:${id}`)).toBe(0);
    await adapter.upsert(id, { accountId: superId }, 60);
    await redis.pexpire(`oidc:AuthorizationCode:${id}`, 800);
    await adapter.consume(id);
    const ttl = await redis.pttl(`oidc:AuthorizationCode:${id}`);
    expect(ttl).toBeGreaterThan(0); expect(ttl).toBeLessThanOrEqual(800);
  });

  it('applies the limiter to raw OIDC routes before the provider handles them', async () => {
    const ip = '198.51.100.42';
    const key = `request-limit:oidc:${createHash('sha256').update(ip).digest('hex')}`;
    await redis.set(key, loadEnv().OIDC_RATE_LIMIT, 'EX', 60);
    try {
      await request(app.getHttpServer()).post('/token').set('X-Forwarded-For', ip).expect(429);
    } finally { await redis.del(key); }
  });

  it('shares OIDC rate-limit counters between independent application instances', async () => {
    const env = { ...loadEnv(), OIDC_RATE_LIMIT: 2 };
    const first = new RequestRateLimiter(redis, env); const second = new RequestRateLimiter(redis, env);
    const req = { path: '/token', method: 'POST', ip: randomUUID() };
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await first.middleware(req as never, res as never, next);
    await second.middleware(req as never, res as never, next);
    await first.middleware(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(2); expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });
});
