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

export function oidcDataKey(model: string, id: string) {
  return `oidc:${model}:${id}`;
}

function grantIndexKey(grantId: string) {
  return `oidc:grant:${grantId}`;
}

function accountIndexKey(accountId: string) {
  return `oidc:account:${accountId}`;
}

const INDEX_FALLBACK_TTL_SECONDS = 30 * 24 * 60 * 60;

// Check-and-mark atomically; never recreate an expired key or lose its TTL.
export const CONSUME_SCRIPT = `
local data = redis.call('GET', KEYS[1])
if not data then return {'missing', ''} end
local payload = cjson.decode(data)
if payload.consumed then return {'reused', payload.grantId or ''} end
if redis.call('PTTL', KEYS[1]) <= 0 then return {'expired', ''} end
payload.consumed = tonumber(ARGV[1])
redis.call('SET', KEYS[1], cjson.encode(payload), 'KEEPTTL')
return {'consumed', ''}
`;

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
    return oidcDataKey(this.model, id);
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

    const indexTtl = expiresIn ?? INDEX_FALLBACK_TTL_SECONDS;
    if (GRANTABLE.has(this.model) && payload.grantId) {
      const grantKey = grantIndexKey(payload.grantId);
      multi.sadd(grantKey, `${this.model}:${id}`);
      // Keep reverse indexes only as long as their longest-lived member. NX
      // handles a new set and GT extends (but never shortens) an existing one.
      multi.expire(grantKey, indexTtl, 'NX');
      multi.expire(grantKey, indexTtl, 'GT');
    }

    const accountId = payload.accountId ?? payload.session?.accountId;
    if (accountId) {
      const accountKey = accountIndexKey(accountId);
      multi.sadd(accountKey, `${this.model}:${id}`);
      multi.expire(accountKey, indexTtl, 'NX');
      multi.expire(accountKey, indexTtl, 'GT');
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
    const [status, grantId] = await this.redis.eval(
      CONSUME_SCRIPT, 1, this.key(id), Math.floor(Date.now() / 1000),
    ) as [string, string];
    if (status === 'consumed') return;
    if (grantId) {
      // Invalidates tokens from a winning request still in flight at reuse.
      await new RedisAdapter('Grant', this.redis).destroy(grantId);
      await this.revokeByGrantId(grantId);
    }
    const { errors } = await import('oidc-provider');
    throw new errors.InvalidGrant('Token is missing, expired, or already consumed');
  }

  async destroy(id: string): Promise<void> {
    const key = this.key(id);
    const data = await this.redis.get(key);
    const multi = this.redis.multi().del(key);
    if (data) {
      const payload = JSON.parse(data) as AdapterPayload;
      if (payload.uid) multi.del(`oidc:uid:${payload.uid}`);
      if (payload.userCode) multi.del(`oidc:userCode:${payload.userCode}`);
      if (payload.grantId) multi.srem(grantIndexKey(payload.grantId), `${this.model}:${id}`);
      const accountId = payload.accountId ?? payload.session?.accountId;
      if (accountId) multi.srem(accountIndexKey(accountId), `${this.model}:${id}`);
    }
    await multi.exec();
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const grantKey = grantIndexKey(grantId);
    const members = await this.redis.smembers(grantKey);
    if (members.length === 0) {
      await this.redis.del(grantKey);
      return;
    }
    await this.redis.del(...members.map((m) => `oidc:${m}`), grantKey);
  }
}

export interface StoredOidcGrant {
  id: string;
  payload: AdapterPayload;
}

/** Returns the live grants currently associated with an account. */
export async function findOidcGrantsForAccount(redis: Redis, accountId: string): Promise<StoredOidcGrant[]> {
  const accountKey = accountIndexKey(accountId);
  const members = (await redis.smembers(accountKey)).filter((member) => member.startsWith('Grant:'));
  if (members.length === 0) return [];

  const values = await redis.mget(...members.map((member) => `oidc:${member}`));
  const grants: StoredOidcGrant[] = [];
  const staleMembers: string[] = [];
  members.forEach((member, index) => {
    const value = values[index];
    if (!value) {
      staleMembers.push(member);
      return;
    }
    const payload = JSON.parse(value) as AdapterPayload;
    if (payload.accountId === accountId) grants.push({ id: member.slice('Grant:'.length), payload });
  });
  if (staleMembers.length > 0) await redis.srem(accountKey, ...staleMembers);
  return grants;
}

/** Revokes a single account-owned grant and every token issued under it. */
export async function revokeOidcGrant(redis: Redis, accountId: string, grantId: string): Promise<boolean> {
  const key = oidcDataKey('Grant', grantId);
  const value = await redis.get(key);
  if (!value) return false;
  const grant = JSON.parse(value) as AdapterPayload;
  if (grant.accountId !== accountId) return false;

  await new RedisAdapter('Grant', redis).revokeByGrantId(grantId);
  await redis.multi().del(key).srem(accountIndexKey(accountId), `Grant:${grantId}`).exec();
  return true;
}

/**
 * Revokes all OIDC sessions, grants, authorization codes, and tokens for an
 * account. This keeps central-session revocation meaningful across the OIDC
 * provider instead of only deleting the portal's PostgreSQL cookie session.
 */
export async function revokeOidcAccount(redis: Redis, accountId: string): Promise<void> {
  const accountKey = accountIndexKey(accountId);
  const members = await redis.smembers(accountKey);
  if (members.length === 0) {
    await redis.del(accountKey);
    return;
  }

  const grantIds = members
    .filter((member) => member.startsWith('Grant:'))
    .map((member) => member.slice('Grant:'.length));
  await Promise.all(grantIds.map((grantId) => new RedisAdapter('Grant', redis).revokeByGrantId(grantId)));

  const values = await redis.mget(...members.map((member) => `oidc:${member}`));
  const multi = redis.multi().del(accountKey, ...members.map((member) => `oidc:${member}`));
  values.forEach((value, index) => {
    const member = members[index];
    if (!value || !member) return;
    const payload = JSON.parse(value) as AdapterPayload;
    if (payload.uid) multi.del(`oidc:uid:${payload.uid}`);
    if (payload.userCode) multi.del(`oidc:userCode:${payload.userCode}`);
    if (payload.grantId) multi.srem(grantIndexKey(payload.grantId), member);
  });
  await multi.exec();
}

export function createRedisAdapterFactory(redis: Redis) {
  return (model: string) => new RedisAdapter(model, redis);
}
