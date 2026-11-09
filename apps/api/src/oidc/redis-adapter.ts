import type Redis from 'ioredis';
import type { Adapter, AdapterPayload } from 'oidc-provider';

// Models whose instances can belong to a "grant" and get bulk-revoked
// together when the grant is revoked (e.g. logging a client out revokes
// every access/refresh token issued under that grant). Mirrors
// oidc-provider's own bundled MemoryAdapter reference implementation.
const GRANTABLE = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
  'PreAuthorizedCode',
]);

function dataKey(model: string, id: string) {
  return `oidc:${model}:${id}`;
}

/**
 * oidc-provider Adapter backed by Redis — every protocol-transient model
 * (authorization codes, access/refresh tokens, interactions, the OP's own
 * session, grants) lives here, never in Postgres (section 6.7: "Redis
 * should be used only for temporary or high-speed state... Short-lived
 * OAuth state... Session cache"). The 'Client' model is the one exception —
 * see client-adapter.ts — since applications are administered through our
 * own admin API and Postgres is their source of truth (section 6.5).
 */
export class RedisAdapter implements Adapter {
  constructor(
    private readonly model: string,
    private readonly redis: Redis,
  ) {}

  private key(id: string) {
    return dataKey(this.model, id);
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void> {
    const multi = this.redis.multi();
    const data = JSON.stringify(payload);
    const key = this.key(id);

    if (expiresIn) multi.set(key, data, 'EX', expiresIn);
    else multi.set(key, data);

    if (this.model === 'Session' && payload.uid) {
      const uidKey = `oidc:uid:${payload.uid}`;
      if (expiresIn) multi.set(uidKey, id, 'EX', expiresIn);
      else multi.set(uidKey, id);
    }

    if (payload.userCode) {
      const codeKey = `oidc:userCode:${payload.userCode}`;
      if (expiresIn) multi.set(codeKey, id, 'EX', expiresIn);
      else multi.set(codeKey, id);
    }

    if (GRANTABLE.has(this.model) && payload.grantId) {
      multi.sadd(`oidc:grant:${payload.grantId}`, `${this.model}:${id}`);
    }

    await multi.exec();
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const data = await this.redis.get(this.key(id));
    return data ? (JSON.parse(data) as AdapterPayload) : undefined;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const id = await this.redis.get(`oidc:uid:${uid}`);
    return id ? this.find(id) : undefined;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const id = await this.redis.get(`oidc:userCode:${userCode}`);
    return id ? this.find(id) : undefined;
  }

  async consume(id: string): Promise<void> {
    const key = this.key(id);
    const [data, ttl] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
    if (!data) return;
    const payload = { ...(JSON.parse(data) as AdapterPayload), consumed: Math.floor(Date.now() / 1000) };
    if (ttl > 0) await this.redis.set(key, JSON.stringify(payload), 'EX', ttl);
    else await this.redis.set(key, JSON.stringify(payload));
  }

  async destroy(id: string): Promise<void> {
    const key = this.key(id);
    const data = await this.redis.get(key);
    const multi = this.redis.multi().del(key);
    if (data) {
      const payload = JSON.parse(data) as AdapterPayload;
      if (payload.uid) multi.del(`oidc:uid:${payload.uid}`);
      if (payload.userCode) multi.del(`oidc:userCode:${payload.userCode}`);
    }
    await multi.exec();
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const grantKey = `oidc:grant:${grantId}`;
    const members = await this.redis.smembers(grantKey);
    if (members.length === 0) return;
    await this.redis.del(...members.map((m) => `oidc:${m}`), grantKey);
  }
}

export function createRedisAdapterFactory(redis: Redis) {
  return (model: string) => new RedisAdapter(model, redis);
}
