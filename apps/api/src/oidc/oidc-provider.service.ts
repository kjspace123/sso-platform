import { Inject, Injectable, Logger } from '@nestjs/common';
import Provider from 'oidc-provider';
import type Redis from 'ioredis';
import type { Env } from '@sso-platform/config';
import { ENV } from '../config/env.module';
import { REDIS } from '../database/redis.module';
import { PrismaService } from '../database/prisma.service';
import { SECRET_CIPHER } from '../common/crypto/crypto.module';
import type { SecretCipher } from '../common/crypto/secret-cipher';
import { createAdapterFactory } from './adapter.factory';
import { createFindAccount } from './account';
import { loadJwks } from './jwks';

/**
 * Owns the oidc-provider `Provider` instance (section 19 Phase 4). Reused
 * for both the mounted middleware (main.ts) and the interaction endpoints
 * (interaction.controller.ts).
 *
 * Deliberately NOT built in onModuleInit(): Nest's lifecycle hooks only run
 * once app.init() finalizes the whole app, including its own router and
 * 404 fallback — by then it's too late to mount oidc-provider's Express
 * middleware "in front of" that fallback. main.ts instead calls
 * initialize() explicitly, right after NestFactory.create() and before
 * app.init()/app.listen(), so `app.use(provider.callback())` is registered
 * before Nest's own router claims every unmatched path.
 */
@Injectable()
export class OidcProviderService {
  private readonly logger = new Logger(OidcProviderService.name);
  private _provider!: Provider;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    private readonly prisma: PrismaService,
  ) {}

  get provider(): Provider {
    return this._provider;
  }

  async initialize(): Promise<Provider> {
    const jwks = await loadJwks(this.env);

    this._provider = new Provider(this.env.OIDC_ISSUER, {
      adapter: createAdapterFactory(this.prisma, this.redis, this.cipher),
      findAccount: createFindAccount(this.prisma),
      jwks,

      cookies: {
        keys: [this.env.COOKIE_SECRET],
        // oidc-provider defaults the interaction cookie's Path to the
        // interactionUrl's pathname (e.g. '/login'), assuming the page that
        // reads it and the page that calls interactionDetails()/
        // interactionFinished() are the same path. Ours aren't — the SSO
        // web app renders /login and /consent, but calls back into this
        // API's /api/oidc/interaction/:uid/* endpoints — so the cookie has
        // to be valid host-wide.
        short: { path: '/' },
      },

      // Only 'sub' (implicit) and email are meaningful today — the User
      // model has nothing else to offer under a 'profile' scope.
      claims: {
        email: ['email', 'email_verified'],
      },

      // oidc-provider's default only rotates a confidential client's refresh
      // token once ~70% of its TTL has passed; section 12/16 want rotation
      // on every use with reuse detection. Rotating always gives us that for
      // free — oidc-provider revokes the whole token family the moment an
      // already-rotated (consumed) refresh token is presented again.
      rotateRefreshToken: true,

      pkce: {
        // Authorization Code Flow with PKCE is the platform's one and only
        // SSO flow (doc header, section 6.4/16) — required unconditionally,
        // not just for public clients as oidc-provider defaults to.
        required: () => true,
      },

      features: {
        devInteractions: { enabled: false }, // we render our own login/consent UI (sso-web)
        rpInitiatedLogout: { enabled: true },
        revocation: { enabled: true },
      },

      routes: {
        // Match section 4/17's documented endpoint name; oidc-provider's own
        // default is `/auth`.
        authorization: '/authorize',
      },

      interactions: {
        url: (_ctx, interaction) => {
          const path = interaction.prompt.name === 'login' ? '/login' : '/consent';
          return `${this.env.SSO_BASE_URL}${path}?interaction=${interaction.uid}`;
        },
      },

      ttl: {
        AccessToken: this.env.ACCESS_TOKEN_TTL,
        IdToken: this.env.ACCESS_TOKEN_TTL,
        RefreshToken: this.env.REFRESH_TOKEN_TTL,
        AuthorizationCode: 300, // 1-5 minutes, single use (section 12)
        Interaction: 600,
        Session: this.env.REFRESH_TOKEN_TTL,
        Grant: this.env.REFRESH_TOKEN_TTL,
      },
    });

    // Trust X-Forwarded-* from Nginx (section 22) for correct scheme/IP in
    // issued tokens and audit-adjacent logging.
    this._provider.proxy = true;

    this.logger.log(`OIDC provider ready — issuer ${this.env.OIDC_ISSUER}`);
    return this._provider;
  }
}
