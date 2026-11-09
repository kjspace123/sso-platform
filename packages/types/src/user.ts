export type UserStatus = 'ACTIVE' | 'DISABLED';

/** Public-safe user shape — never includes passwordHash. */
export interface PublicUser {
  id: string;
  email: string;
  pendingEmail: string | null;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  roles: string[];
  permissions: string[];
}
