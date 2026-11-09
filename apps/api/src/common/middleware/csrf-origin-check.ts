import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF mitigation (section 16) for our own cookie-authenticated `/api/*`
 * controllers. SameSite=Lax on the session cookie already blocks the
 * classic cross-site form-POST attack, but isn't considered sufficient on
 * its own (older browsers, SameSite bugs, subdomain-scoped attacks) — this
 * adds an explicit check that state-changing requests actually originated
 * from one of the platform's own frontends.
 *
 * Deliberately scoped to /api/* only: oidc-provider's own routes
 * (/authorize, /token, …) are protocol-authenticated differently (PKCE,
 * client secrets, signed state) and are expected to be called
 * server-to-server without an Origin header at all.
 */
export function createCsrfOriginCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api') || !STATE_CHANGING_METHODS.has(req.method)) {
      return next();
    }

    const origin = req.headers.origin ?? refererOrigin(req.headers.referer);
    if (!origin) {
      return next(new ForbiddenException('Missing Origin header on a state-changing request'));
    }
    if (!allowed.has(origin)) {
      return next(new ForbiddenException('Request origin is not allowed'));
    }
    return next();
  };
}

function refererOrigin(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
