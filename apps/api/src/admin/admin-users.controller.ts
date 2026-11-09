import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AUDIT_ACTIONS, PERMISSIONS } from '@sso-platform/types';
import { paginationSchema, updateProfileSchema, type PaginationInput, type UpdateProfileInput } from '@sso-platform/validation';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

@ApiTags('admin/users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  async list(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput) {
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count(),
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
  ) {
    await this.users.updateProfile(id, body);
    return this.users.toPublic(await this.users.findByIdOrThrow(id));
  }

  @Post(':id/disable')
  @RequirePermission(PERMISSIONS.USER_DISABLE)
  async disable(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    await this.users.findByIdOrThrow(id);
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
    await this.users.findByIdOrThrow(id);
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
}
