import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsModule } from '../applications/applications.module';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AdminApplicationsController } from './admin-applications.controller';
import { AdminAuditController } from './admin-audit.controller';
import { AdminPermissionsController, AdminRolesController } from './admin-roles.controller';
import { AdminSessionsController } from './admin-sessions.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminSecurityController } from './admin-security.controller';

/** Aggregates every /admin/* controller (section 17). Route-level access is
 * enforced per-endpoint via @RequirePermission (section 14) — there is no
 * single "is admin" gate, by design. */
@Module({
  imports: [AuthModule, UsersModule, ApplicationsModule, RolesModule, PermissionsModule, SessionsModule, AuditModule],
  controllers: [
    AdminUsersController,
    AdminApplicationsController,
    AdminRolesController,
    AdminPermissionsController,
    AdminAuditController,
    AdminSessionsController,
    AdminSecurityController,
  ],
})
export class AdminModule {}
