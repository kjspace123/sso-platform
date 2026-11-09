import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AUDIT_ACTIONS } from '@sso-platform/types';
import { updateProfileSchema, type UpdateProfileInput } from '@sso-platform/validation';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from './users.service';
import { OidcGrantsService } from '../oidc/oidc-grants.service';
import { AuditService } from '../audit/audit.service';
import { requestContext } from '../common/http/request-context';
import { AuthService } from '../auth/auth.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly oidcGrants: OidcGrantsService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.toPublic(await this.users.findByIdOrThrow(user.id));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
    @Req() req: Request,
  ) {
    const emailChanged = body.email !== undefined && body.email !== user.email;
    await this.users.updateProfile(user.id, body);
    await this.audit.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: requestContext(req).ipAddress,
    });
    if (emailChanged) await this.auth.resendEmailVerification(user.id, requestContext(req));
    return this.users.toPublic(await this.users.findByIdOrThrow(user.id));
  }

  @Get('me/sessions')
  async mySessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.sessions.listActiveForUser(user.id);
    return sessions.map((s) => this.sessions.toPublic(s, user.sessionId));
  }

  @Get('me/applications')
  connectedApplications(@CurrentUser() user: AuthenticatedUser) {
    return this.oidcGrants.listForAccount(user.id);
  }

  @Delete('me/applications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.oidcGrants.revokeForApplication(user.id, id);
    await this.audit.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.APPLICATION_ACCESS_REVOKED,
      resourceType: 'Application',
      resourceId: id,
      ipAddress: requestContext(req).ipAddress,
    });
  }

  @Delete('me/sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeMySession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const session = await this.sessions.findById(id);
    if (!session || session.userId !== user.id) return; // don't leak existence of other users' sessions
    await this.sessions.revoke(id);
    await this.audit.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      resourceType: 'Session',
      resourceId: id,
      ipAddress: requestContext(req).ipAddress,
    });
  }
}
