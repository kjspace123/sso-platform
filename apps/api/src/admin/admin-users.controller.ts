import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AUDIT_ACTIONS, PERMISSIONS } from '@sso-platform/types';
import {
  listUsersSchema,
  updateProfileSchema,
  updateUserRolesSchema,
  type ListUsersInput,
  type UpdateProfileInput,
  type UpdateUserRolesInput,
} from '@sso-platform/validation';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuthService } from '../auth/auth.service';
import { requestContext } from '../common/http/request-context';

@ApiTags('admin/users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  async list(@Query(new ZodValidationPipe(listUsersSchema)) query: ListUsersInput) {
    const { page, pageSize, search } = query;
    const where = search ? { email: { contains: search, mode: 'insensitive' as const } } : undefined;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map((u) => this.users.toPublic(u)), total, page, pageSize };
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_READ)
  async get(@Param('id') id: string) {
    return this.users.toPublic(await this.users.findByIdOrThrow(id));
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_UPDATE)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const target = await this.users.assertCanManage(id, admin);
    await this.users.updateProfile(id, body);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
      resourceType: 'User',
      resourceId: id,
      ipAddress: requestContext(req).ipAddress,
    });
    if (body.email && body.email !== target.email) {
      await this.auth.resendEmailVerification(id, requestContext(req));
    }
    return this.users.toPublic(await this.users.findByIdOrThrow(id));
  }

  @Put(':id/roles')
  @RequirePermission(PERMISSIONS.ROLE_UPDATE)
  async updateRoles(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRolesSchema)) body: UpdateUserRolesInput,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.users.assertCanManage(id, admin);
    const before = await this.prisma.userRole.findMany({ where: { userId: id }, select: { roleId: true } });
    const beforeIds = new Set(before.map((item) => item.roleId));
    const afterIds = new Set(body.roleIds);
    await this.assertSuperAdminRemains(id, beforeIds, afterIds);

    await this.roles.setForUser(id, body.roleIds);
    const events = [
      ...body.roleIds.filter((roleId) => !beforeIds.has(roleId)).map((roleId) => ({ roleId, action: AUDIT_ACTIONS.ROLE_ASSIGNED })),
      ...before.map((item) => item.roleId).filter((roleId) => !afterIds.has(roleId)).map((roleId) => ({ roleId, action: AUDIT_ACTIONS.ROLE_REMOVED })),
    ];
    await Promise.all(
      events.map((event) =>
        this.audit.record({
          actorId: admin.id,
          action: event.action,
          resourceType: 'User',
          resourceId: id,
          ipAddress: req.ip ?? null,
          metadata: { roleId: event.roleId },
        }),
      ),
    );
    return this.users.toPublic(await this.users.findByIdOrThrow(id));
  }

  @Post(':id/disable')
  @RequirePermission(PERMISSIONS.USER_DISABLE)
  async disable(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    const target = await this.users.assertCanManage(id, admin);
    if (target.roles.some((userRole) => userRole.role.name === 'super-admin')) {
      await this.assertSuperAdminRemains(id, new Set(target.roles.map((item) => item.roleId)), new Set());
    }
    await this.prisma.user.update({ where: { id }, data: { status: 'DISABLED' } });
    await this.sessions.revokeAllForUser(id);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.USER_DISABLED,
      resourceType: 'User',
      resourceId: id,
      ipAddress: req.ip ?? null,
    });
    return this.users.toPublic(await this.users.findByIdOrThrow(id));
  }

  @Post(':id/enable')
  @RequirePermission(PERMISSIONS.USER_DISABLE)
  async enable(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    await this.users.assertCanManage(id, admin);
    await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.USER_ENABLED,
      resourceType: 'User',
      resourceId: id,
      ipAddress: req.ip ?? null,
    });
    return this.users.toPublic(await this.users.findByIdOrThrow(id));
  }

  @Post(':id/revoke-sessions')
  @RequirePermission(PERMISSIONS.SESSION_REVOKE)
  async revokeSessions(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    await this.users.findByIdOrThrow(id);
    await this.sessions.revokeAllForUser(id);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      resourceType: 'User',
      resourceId: id,
      ipAddress: req.ip ?? null,
      metadata: { scope: 'all-sessions' },
    });
    return { success: true };
  }

  private async assertSuperAdminRemains(userId: string, beforeRoleIds: Set<string>, afterRoleIds: Set<string>) {
    const superAdmin = await this.prisma.role.findUnique({ where: { name: 'super-admin' }, select: { id: true } });
    if (!superAdmin || !beforeRoleIds.has(superAdmin.id) || afterRoleIds.has(superAdmin.id)) return;

    const otherActiveSuperAdmins = await this.prisma.userRole.count({
      where: { roleId: superAdmin.id, userId: { not: userId }, user: { status: 'ACTIVE' } },
    });
    if (otherActiveSuperAdmins === 0) throw new BadRequestException('The last active super-admin cannot be removed or disabled');
  }
}
