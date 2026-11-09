import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  it('consumes a valid token atomically', async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-1',
          userId: 'user-1',
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new PasswordResetService(prisma as never);

    await expect(service.consume('secret-token')).resolves.toBe('user-1');
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'reset-1', usedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('rejects a token that lost a concurrent consume race', async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-1',
          userId: 'user-1',
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(new PasswordResetService(prisma as never).consume('secret-token')).resolves.toBeNull();
  });
});
