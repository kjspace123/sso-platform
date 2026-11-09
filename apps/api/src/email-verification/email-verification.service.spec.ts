import { EmailVerificationService } from './email-verification.service';

const liveRecord = {
  id: 'verification-1', userId: 'user-1', email: 'new@example.com', usedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { email: 'old@example.com', pendingEmail: 'new@example.com' },
};

function fixture(record = liveRecord, count = 1) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    emailVerificationToken: { updateMany: jest.fn().mockResolvedValue({ count }) },
    passwordResetToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(record.user), update: jest.fn() },
  };
  const prisma = {
    emailVerificationToken: { findUnique: jest.fn().mockResolvedValue(record) },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { tx, prisma, service: new EmailVerificationService(prisma as never) };
}

describe('EmailVerificationService', () => {
  it('promotes the verified pending email and invalidates old recovery links', async () => {
    const { service, tx } = fixture();
    await expect(service.consume('token')).resolves.toEqual({ userId: 'user-1', email: 'new@example.com' });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' }, data: { email: 'new@example.com', pendingEmail: null, emailVerified: true },
    });
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalled();
  });
  it('rejects a replaced or cancelled pending email', async () => {
    const { service, prisma } = fixture({ ...liveRecord, user: { email: 'old@example.com', pendingEmail: 'different@example.com' } });
    await expect(service.consume('token')).resolves.toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a token that loses a concurrent consume race', async () => {
    const { service, tx } = fixture(liveRecord, 0);
    await expect(service.consume('token')).resolves.toBeNull();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('rechecks the target after acquiring the account lock', async () => {
    const { service, tx } = fixture();
    tx.user.findUniqueOrThrow.mockResolvedValue({ email: 'old@example.com', pendingEmail: 'changed@example.com' });
    await expect(service.consume('token')).resolves.toBeNull();
    expect(tx.emailVerificationToken.updateMany).not.toHaveBeenCalled();
  });
});
