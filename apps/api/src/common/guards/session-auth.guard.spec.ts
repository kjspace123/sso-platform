import { SessionAuthGuard } from './session-auth.guard';
import { createSessionToken, hashSessionToken } from '../../sessions/session-token';

function context(token: string) {
  const request = { cookies: { sso_session: token } };
  return { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => request }) };
}

describe('SessionAuthGuard', () => {
  it('rejects a public session ID without querying the database', async () => {
    const prisma = { session: { findUnique: jest.fn() } };
    const guard = new SessionAuthGuard(prisma as never, { getAllAndOverride: () => false } as never);
    await expect(guard.canActivate(context('cm-public-session-id') as never)).rejects.toThrow('No active session');
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });
  it('looks up only a hash of a valid bearer token', async () => {
    const prisma = { session: { findUnique: jest.fn().mockResolvedValue(null) } };
    const token = createSessionToken();
    const guard = new SessionAuthGuard(prisma as never, { getAllAndOverride: () => false } as never);
    await expect(guard.canActivate(context(token) as never)).rejects.toThrow('Session is invalid');
    expect(prisma.session.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashSessionToken(token) } }));
  });
});
