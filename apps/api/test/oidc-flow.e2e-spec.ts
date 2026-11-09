import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { importJWK, jwtVerify } from 'jose';
import { loadEnv } from '@sso-platform/config';
import { createTestApp, trustedOrigin } from './utils/test-app';
import { CookieJar } from './utils/cookies';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Exercises the full Authorization Code + PKCE round trip end to end — the
 * single highest-value path in the whole platform and, before this suite,
 * completely uncovered by any test (see README/plan section 21). Creates
 * its own throwaway OAuth client and end-user account via the real API
 * rather than depending on prisma/seed.ts's demo-app-a/b fixtures, so this
 * suite is self-contained and safe to run in CI regardless of SEED_* env.
 */
describe('OIDC authorization code + PKCE flow (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let origin: string;
  let issuer: string;

  const redirectUri = 'http://localhost:9999/callback';
  const endUserEmail = `e2e-oidc-user-${Date.now()}@example.com`;
  const endUserPassword = 'Correct-Horse-Battery-Staple-1!';

  let clientId: string;
  let clientSecret: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const env = loadEnv(process.env);
    origin = trustedOrigin(env);
    issuer = env.OIDC_ISSUER;

    // --- Fixture setup: an admin account (to register a client) and the
    // end user who will actually log in through the flow. ---
    const adminEmail = `e2e-oidc-admin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email: adminEmail, password: endUserPassword })
      .expect(201);

    // Direct DB grant rather than an API call — this suite is testing the
    // OIDC protocol flow, not role assignment (that's covered by the admin
    // controller's own responsibility elsewhere); mirrors prisma/seed.ts's
    // own super-admin bootstrapping.
    const user = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super-admin' } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: user.id, roleId: superAdminRole.id },
    });
    // The permission set is resolved into the session at login time (see
    // SessionAuthGuard) — the register-time session predates the grant
    // above, so re-authenticate to pick it up.
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: adminEmail, password: endUserPassword })
      .expect(200);
    const freshAdminCookie = new CookieJar().absorb(adminLoginRes).get('sso_session')!;

    const clientRes = await request(app.getHttpServer())
      .post('/api/admin/applications')
      .set('Origin', origin)
      .set('Cookie', freshAdminCookie)
      .send({
        name: 'E2E Test Client',
        type: 'CONFIDENTIAL',
        redirectUris: [redirectUri],
        postLogoutRedirectUris: ['http://localhost:9999'],
      })
      .expect(201);
    clientId = clientRes.body.clientId;
    clientSecret = clientRes.body.clientSecret;
    expect(clientId).toBeTruthy();
    expect(clientSecret).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email: endUserEmail, password: endUserPassword })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes authorize → login → consent → token → userinfo, with a verified ID token', async () => {
    const jar = new CookieJar();
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    // 1. /authorize with no session yet → redirected into an interaction.
    const authorizeRes = await request(app.getHttpServer())
      .get('/authorize')
      .query({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email offline_access',
        prompt: 'consent',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
      })
      .expect(303);
    jar.absorb(authorizeRes);
    const loginLocation = new URL(authorizeRes.headers.location);
    expect(loginLocation.pathname).toBe('/login');
    const interactionUid = loginLocation.searchParams.get('interaction');
    expect(interactionUid).toBeTruthy();

    // 2. Submit credentials against the interaction — this is what
    // sso-web's /login page does under the hood.
    const loginRes = await request(app.getHttpServer())
      .post(`/api/oidc/interaction/${interactionUid}/login`)
      .set('Origin', origin)
      .set('Cookie', jar.header())
      .send({ email: endUserEmail, password: endUserPassword })
      .expect(201);
    jar.absorb(loginRes);
    const resumeAfterLogin: string = loginRes.body.redirectTo;
    expect(resumeAfterLogin).toBeTruthy();

    // 3. Resume — first grant for this client/account, so oidc-provider
    // requires consent next.
    const resumeRes = await request(app.getHttpServer())
      .get(new URL(resumeAfterLogin).pathname + new URL(resumeAfterLogin).search)
      .set('Cookie', jar.header())
      .expect(303);
    jar.absorb(resumeRes);
    const consentLocation = new URL(resumeRes.headers.location);
    expect(consentLocation.pathname).toBe('/consent');

    // 4. Confirm consent.
    const confirmRes = await request(app.getHttpServer())
      .post(`/api/oidc/interaction/${interactionUid}/confirm`)
      .set('Origin', origin)
      .set('Cookie', jar.header())
      .expect(201);
    jar.absorb(confirmRes);
    const resumeAfterConsent: string = confirmRes.body.redirectTo;

    // 5. Resume again — this time oidc-provider issues the authorization
    // code and redirects to the client's own redirect_uri.
    const codeRes = await request(app.getHttpServer())
      .get(new URL(resumeAfterConsent).pathname + new URL(resumeAfterConsent).search)
      .set('Cookie', jar.header())
      .expect(303);
    jar.absorb(codeRes);
    const callbackUrl = new URL(codeRes.headers.location);
    expect(callbackUrl.origin + callbackUrl.pathname).toBe(redirectUri);
    expect(callbackUrl.searchParams.get('state')).toBe(state);
    const code = callbackUrl.searchParams.get('code');
    expect(code).toBeTruthy();

    // 6. Exchange the code for tokens — server-to-server, client_secret_basic,
    // no cookies/Origin involved (this is exactly what demo-app-a/b's own
    // callback route does).
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await request(app.getHttpServer())
      .post('/token')
      .set('Authorization', `Basic ${basicAuth}`)
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      })
      .expect(200);
    expect(tokenRes.body.access_token).toBeTruthy();
    expect(tokenRes.body.id_token).toBeTruthy();

    // 7. Verify the ID token's signature against the live JWKS endpoint —
    // not just decode it — and check iss/aud/nonce. supertest doesn't bind
    // a real port, so fetch the JWKS via supertest itself and import the
    // matching key directly rather than jose's createRemoteJWKSet (which
    // needs a reachable URL to fetch from).
    const jwksRes = await request(app.getHttpServer()).get('/jwks').expect(200);
    const matchingJwk = jwksRes.body.keys.find((k: { alg?: string; use?: string }) => k.use === 'sig');
    const publicKey = await importJWK(matchingJwk, matchingJwk.alg ?? 'RS256');
    const { payload } = await jwtVerify(tokenRes.body.id_token, publicKey, {
      issuer,
      audience: clientId,
    });
    expect(payload.nonce).toBe(nonce);
    expect(payload.sub).toBeTruthy();
    // Per OIDC core (and this platform's claims config), scope-requested
    // claims like email are delivered via the userinfo endpoint for the
    // authorization code flow, not duplicated into the ID token itself —
    // asserted below instead of here.

    // 8. Userinfo endpoint with the access token.
    const userinfoRes = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${tokenRes.body.access_token}`)
      .expect(200);
    expect(userinfoRes.body.email).toBe(endUserEmail);
    expect(userinfoRes.body.sub).toBe(payload.sub);

    // Rotation and replay must invalidate the entire refresh-token family.
    expect(tokenRes.body.refresh_token).toBeTruthy();
    const rotated = await request(app.getHttpServer()).post('/token')
      .set('Authorization', `Basic ${basicAuth}`).type('form')
      .send({ grant_type: 'refresh_token', refresh_token: tokenRes.body.refresh_token }).expect(200);
    expect(rotated.body.refresh_token).not.toBe(tokenRes.body.refresh_token);
    await request(app.getHttpServer()).post('/token')
      .set('Authorization', `Basic ${basicAuth}`).type('form')
      .send({ grant_type: 'refresh_token', refresh_token: tokenRes.body.refresh_token }).expect(400);
    await request(app.getHttpServer()).post('/token')
      .set('Authorization', `Basic ${basicAuth}`).type('form')
      .send({ grant_type: 'refresh_token', refresh_token: rotated.body.refresh_token }).expect(400);
    await request(app.getHttpServer()).get('/me')
      .set('Authorization', `Bearer ${rotated.body.access_token}`).expect(401);
    await request(app.getHttpServer()).post('/token')
      .set('Authorization', `Basic ${basicAuth}`).type('form')
      .send({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier }).expect(400);

  });

  it('rejects an authorize request for an unregistered redirect_uri', async () => {
    await request(app.getHttpServer())
      .get('/authorize')
      .query({
        client_id: clientId,
        redirect_uri: 'http://evil.example/callback',
        response_type: 'code',
        scope: 'openid',
        code_challenge: createHash('sha256').update('x').digest('base64url'),
        code_challenge_method: 'S256',
        state: 'x',
      })
      .expect(400);
  });
});
