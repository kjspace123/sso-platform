export interface PublicRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface PublicPermission {
  id: string;
  name: string;
  description: string | null;
}

/** Canonical permission names. Keep in sync with prisma/seed and section 10.3 of the plan. */
export const PERMISSIONS = {
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DISABLE: 'user:disable',

  APPLICATION_READ: 'application:read',
  APPLICATION_CREATE: 'application:create',
  APPLICATION_UPDATE: 'application:update',
  APPLICATION_DISABLE: 'application:disable',

  SESSION_READ: 'session:read',
  SESSION_REVOKE: 'session:revoke',

  ROLE_READ: 'role:read',
  ROLE_UPDATE: 'role:update',

  AUDIT_READ: 'audit:read',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
