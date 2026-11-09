import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AUDIT_ACTIONS, PERMISSIONS } from '@sso-platform/types';
import { createRoleSchema, updateRoleSchema, type CreateRoleInput, type UpdateRoleInput } from '@sso-platform/validation';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { RolesService } from '../roles/roles.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('admin/roles')
@Controller('admin/roles')
export class AdminRolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.ROLE_READ)
  async list() {
    return (await this.roles.list()).map((r) => this.roles.toPublic(r));
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLE_UPDATE)
  async create(@Body(new ZodValidationPipe(createRoleSchema)) body: CreateRoleInput) {
    return this.roles.toPublic(await this.roles.create(body));
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.ROLE_UPDATE)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: UpdateRoleInput,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const role = await this.roles.update(id, body);
    await this.audit.record({
      actorId: admin.id,
      action: AUDIT_ACTIONS.PERMISSION_UPDATED,
      resourceType: 'Role',
      resourceId: id,
      ipAddress: req.ip ?? null,
    });
    return this.roles.toPublic(role);
  }
}

@ApiTags('admin/permissions')
@Controller('admin/permissions')
export class AdminPermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ROLE_READ)
  async list() {
    return (await this.permissions.list()).map((p) => this.permissions.toPublic(p));
  }
}
