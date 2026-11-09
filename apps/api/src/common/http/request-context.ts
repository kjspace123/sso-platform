import type { Request } from 'express';
import type { RequestContext } from '../../auth/auth.service';

export function requestContext(req: Request): RequestContext {
  return { ipAddress: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}
