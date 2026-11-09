import type Redis from 'ioredis';
import type { Adapter, AdapterFactory } from 'oidc-provider';
import type { PrismaService } from '../database/prisma.service';
import type { SecretCipher } from '../common/crypto/secret-cipher';
import { RedisAdapter } from './redis-adapter';
import { ClientAdapter } from './client-adapter';

/** Dispatches oidc-provider's per-model adapter requests (section 6.4/6.5/6.7). */
export function createAdapterFactory(prisma: PrismaService, redis: Redis, cipher: SecretCipher): AdapterFactory {
  const clientAdapter = new ClientAdapter(prisma, cipher);

  return (name: string): Adapter => {
    if (name === 'Client') return clientAdapter;
    return new RedisAdapter(name, redis);
  };
}
