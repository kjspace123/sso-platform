import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password and verifies it correctly', async () => {
    const hash = await service.hash('Sup3rSecret!');
    expect(hash).not.toEqual('Sup3rSecret!');
    await expect(service.verify(hash, 'Sup3rSecret!')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  describe('verifyOrDummy', () => {
    it('verifies against the real hash when one is provided', async () => {
      const hash = await service.hash('Sup3rSecret!');
      await expect(service.verifyOrDummy(hash, 'Sup3rSecret!')).resolves.toBe(true);
      await expect(service.verifyOrDummy(hash, 'wrong-password')).resolves.toBe(false);
    });

    it('always returns false without a real hash, but still does real Argon2id work', async () => {
      const dummyStart = performance.now();
      await expect(service.verifyOrDummy(null, 'anything')).resolves.toBe(false);
      const dummyDuration = performance.now() - dummyStart;
      await expect(service.verifyOrDummy(undefined, 'anything')).resolves.toBe(false);

      // A no-op (skipping verification entirely) would return near-instantly;
      // this asserts real Argon2id work happened, which is what keeps this
      // path's timing comparable to the real-hash path — see auth.service.ts.
      expect(dummyDuration).toBeGreaterThan(1);
    });
  });
});
