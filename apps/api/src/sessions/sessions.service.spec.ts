import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  it('revokes OIDC account state when revoking all browser sessions', async () => {
    const prisma = { session: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    const redis = {
      smembers: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1),
    };
    const service = new SessionsService(prisma as never, redis as never);

    await service.revokeAllForUser('user-1');

    expect(prisma.session.updateMany).toHaveBeenCalled();
    expect(redis.smembers).toHaveBeenCalledWith('oidc:account:user-1');
    expect(redis.del).toHaveBeenCalledWith('oidc:account:user-1');
  });
});

describe('Session credentials', () => {
  it('stores a hash and exposes only the unrelated management ID in public DTOs', async () => {
    const now = new Date();
    const prisma = { session: { create: jest.fn(async ({ data }) => ({
      ...data, id: 'public-session-id', createdAt: now, lastSeenAt: now, revokedAt: null,
    })) } };
    const service = new SessionsService(prisma as never, {} as never);
    const session = await service.create({ userId: 'user-1', ttlSeconds: 60 });
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.tokenHash).not.toEqual(session.token);
    expect(prisma.session.create.mock.calls[0]?.[0].data).not.toHaveProperty('token');
    const dto = service.toPublic(session);
    expect(dto.id).toBe('public-session-id');
    expect(dto).not.toHaveProperty('token');
    expect(dto).not.toHaveProperty('tokenHash');
  });
});
