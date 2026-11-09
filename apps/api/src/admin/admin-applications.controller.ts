import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AUDIT_ACTIONS, PERMISSIONS } from '@sso-platform/types';
import {
  createApplicationSchema,
  updateApplicationSchema,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from '@sso-platform/validation';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ApplicationsService } from '../applications/applications.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('admin/applications')
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.APPLICATION_READ)
  async list() {
    return (await this.applications.list()).map((a) => this.applications.toPublic(a));
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.APPLICATION_READ)
  async get(@Param('id') id: string) {
    return this.applications.toPublic(await this.applications.findByIdOrThrow(id));
  }

  @Post()
  @RequirePermission(PERMISSIONS.APPLICATION_CREATE)
  async create(
    @Body(new ZodValidationPipe(createApplicationSchema)) body: CreateApplicationInput,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const { application, clientSecret } = await this.applications.create(body);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.APPLICATION_CREATED,
      resourceType: 'Application',
      resourceId: application.id,
      ipAddress: req.ip ?? null,
    });
    // Client secret is only ever returned at creation/rotation time.
    return { ...this.applications.toPublic(application), clientSecret };
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.APPLICATION_UPDATE)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateApplicationSchema)) body: UpdateApplicationInput,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const application = await this.applications.update(id, body);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.APPLICATION_UPDATED,
      resourceType: 'Application',
      resourceId: id,
      ipAddress: req.ip ?? null,
    });
    return this.applications.toPublic(application);
  }

  @Post(':id/rotate-secret')
  @RequirePermission(PERMISSIONS.APPLICATION_UPDATE)
  async rotateSecret(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    const clientSecret = await this.applications.rotateSecret(id);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.CLIENT_SECRET_ROTATED,
      resourceType: 'Application',
      resourceId: id,
      ipAddress: req.ip ?? null,
    });
    return { clientSecret };
  }

  @Post(':id/disable')
  @RequirePermission(PERMISSIONS.APPLICATION_DISABLE)
  async disable(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    const application = await this.applications.disable(id);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.APPLICATION_DISABLED,
      resourceType: 'Application',
      resourceId: id,
      ipAddress: req.ip ?? null,
    });
    return this.applications.toPublic(application);
  }
}
