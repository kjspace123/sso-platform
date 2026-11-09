import type { Response } from 'supertest';

/**
 * Minimal cookie jar for e2e tests driving multi-request flows (the OIDC
 * interaction dance sets/reads several cookies of its own — session,
 * interaction, resume — on top of our sso_session). supertest doesn't
 * persist cookies across requests like a browser does, so this accumulates
 * Set-Cookie values from each response and produces a merged Cookie header
 * for the next one.
 */
export class CookieJar {
  private readonly jar = new Map<string, string>();

  absorb(res: Response): this {
    const setCookie = res.headers['set-cookie'] as unknown as string[] | string | undefined;
    const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    for (const raw of values) {
      const pair = raw.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      this.jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    return this;
  }

  get(name: string): string | undefined {
    const value = this.jar.get(name);
    return value === undefined ? undefined : `${name}=${value}`;
  }

  /** Cookie header value covering every cookie collected so far. */
  header(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}
