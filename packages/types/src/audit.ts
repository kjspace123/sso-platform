/** Audit event names. Keep in sync with section 18 of the implementation plan. */
export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_LOGOUT_ALL: 'USER_LOGOUT_ALL',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  USER_DISABLED: 'USER_DISABLED',
  USER_ENABLED: 'USER_ENABLED',
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  APPLICATION_UPDATED: 'APPLICATION_UPDATED',
  APPLICATION_DISABLED: 'APPLICATION_DISABLED',
  CLIENT_SECRET_ROTATED: 'CLIENT_SECRET_ROTATED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_REMOVED: 'ROLE_REMOVED',
  PERMISSION_UPDATED: 'PERMISSION_UPDATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface PublicAuditLog {
  id: string;
  actorId: string | null;
  action: AuditAction | string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
