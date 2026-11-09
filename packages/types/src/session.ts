export interface PublicSession {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current?: boolean;
  /** Only populated by admin endpoints that list sessions across users. */
  userEmail?: string;
}
