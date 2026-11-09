import { SetMetadata } from '@nestjs/common';
import type { PermissionName } from '@sso-platform/types';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Permission-based authorization (section 14). Prefer this over hardcoded
 * role checks like `if (user.role === 'admin')`.
 *
 * @example @RequirePermission('user:update')
 */
export const RequirePermission = (permission: PermissionName) => SetMetadata(PERMISSION_KEY, permission);
