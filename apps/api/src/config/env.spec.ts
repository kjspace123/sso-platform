import { loadEnv } from '@sso-platform/config';

const baseEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  SSO_BASE_URL: 'http://localhost:3000',
  ADMIN_BASE_URL: 'http://localhost:3001',
  DEMO_APP_A_BASE_URL: 'http://localhost:3002',
  DEMO_APP_B_BASE_URL: 'http://localhost:3003',
  OIDC_ISSUER: 'http://localhost:4000',
  CLIENT_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  COOKIE_SECRET: 'a-cookie-secret-with-at-least-32-characters',
};

describe('environment validation', () => {
  it('treats blank optional SMTP values as unset in development', () => {
    const env = loadEnv({ ...baseEnv, SMTP_HOST: '', SMTP_PORT: '', SMTP_SECURE: '' });
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.SMTP_PORT).toBeUndefined();
    expect(env.SMTP_SECURE).toBe(false);
  });

  it('requires persistent signing and mail configuration in production', () => {
    expect(() => loadEnv({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/OIDC_JWKS/);
    expect(() => loadEnv({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/SMTP_HOST/);
  });
});

describe('production transport and request limits', () => {
  it('rejects HTTP issuer/frontend URLs even with mail and signing configuration', () => {
    expect(() => loadEnv({ ...baseEnv, NODE_ENV: 'production', OIDC_JWKS: '{"keys":[]}',
      SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'user', SMTP_PASSWORD: 'secret', SMTP_FROM: 'sso@example.com',
    })).toThrow(/must use HTTPS/);
  });
  it('rejects disabled or invalid request budgets and token lifetimes', () => {
    for (const name of ['API_RATE_LIMIT', 'OIDC_RATE_LIMIT', 'ACCESS_TOKEN_TTL', 'REFRESH_TOKEN_TTL']) {
      expect(() => loadEnv({ ...baseEnv, [name]: '0' })).toThrow(name);
    }
  });
});
