import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password and verifies it correctly', async () => {
    const hash = await service.hash('Sup3rSecret!');
    expect(hash).not.toEqual('Sup3rSecret!');
    await expect(service.verify(hash, 'Sup3rSecret!')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});
