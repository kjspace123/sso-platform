import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AUDIT_ACTIONS, PERMISSIONS } from '@sso-platform/types';
import { listSessionsSchema, type ListSessionsInput } from '@sso-platform/validation';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { SessionsService } from '../sessions/sessions.service';
import { AuditService } from '../audit/audit.service';

/** Platform-wide session visibility/revocation (section 2.2), distinct from
 * the per-user revoke-sessions action on AdminUsersController. */
@ApiTags('admin/sessions')
@Controller('admin/sessions')
export class AdminSessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.SESSION_READ)
  async list(@Query(new ZodValidationPipe(listSessionsSchema)) query: ListSessionsInput) {
    const { items, total, page, pageSize } = await this.sessions.listAll(query);
    return { items: items.map((s) => this.sessions.toPublicWithUser(s)), total, page, pageSize };
  }

  @Post(':id/revoke')
  @RequirePermission(PERMISSIONS.SESSION_REVOKE)
  async revoke(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    await this.sessions.revoke(id);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      resourceType: 'Session',
      resourceId: id,
      ipAddress: req.ip ?? null,
    });
    return { success: true };
  }
}
