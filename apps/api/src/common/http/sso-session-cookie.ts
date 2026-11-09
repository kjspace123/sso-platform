import type { Response } from 'express';
import type { Env } from '@sso-platform/config';
import { SSO_SESSION_COOKIE } from '../guards/session-auth.guard';

/**
 * Sets the SSO web app's own browser session cookie (section 13). Shared
 * between AuthController (direct /auth/login) and the OIDC interaction
 * controller (logging in as part of an /authorize flow) so both paths leave
 * the user in the exact same "logged in" state.
 */
export function setSsoSessionCookie(res: Response, token: string, env: Env) {
  res.cookie(SSO_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: env.REFRESH_TOKEN_TTL * 1000,
    path: '/',
  });
}
