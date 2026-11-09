import { UsersService } from './users.service';

describe('UsersService', () => {
  it('keeps the login and recovery address until its replacement is verified', async () => {
    const prisma = { user: {
      findUnique: jest.fn().mockResolvedValueOnce({ email: 'old@example.com' }).mockResolvedValueOnce(null),
      update: jest.fn().mockResolvedValue({}),
    } };
    await new UsersService(prisma as never).updateProfile('user-1', { email: 'new@example.com' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' }, data: { pendingEmail: 'new@example.com' },
    });
  });

  it('cancels a pending change when the current address is submitted', async () => {
    const prisma = { user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'same@example.com' }),
      update: jest.fn().mockResolvedValue({}),
    } };
    await new UsersService(prisma as never).updateProfile('user-1', { email: 'same@example.com' });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { pendingEmail: null } });
  });

  it('rejects edits of more privileged accounts before profile mutation', async () => {
    const target = { roles: [{ role: { permissions: [{ permission: { name: 'role:update' } }] } }] };
    const service = new UsersService({ user: { findUnique: jest.fn().mockResolvedValue(target) } } as never);
    // toPublic also serializes dates; return only the permission projection here.
    jest.spyOn(service, 'toPublic').mockReturnValue({ permissions: ['role:update'] } as never);
    await expect(service.assertCanManage('super-admin', { permissions: ['user:update'] } as never))
      .rejects.toThrow('Cannot manage an account');
  });
});
