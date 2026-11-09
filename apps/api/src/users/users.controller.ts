import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { updateProfileSchema, type UpdateProfileInput } from '@sso-platform/validation';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.toPublic(await this.users.findByIdOrThrow(user.id));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    await this.users.updateProfile(user.id, body);
    return this.users.toPublic(await this.users.findByIdOrThrow(user.id));
  }

  @Get('me/sessions')
  async mySessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.sessions.listActiveForUser(user.id);
    return sessions.map((s) => this.sessions.toPublic(s, user.sessionId));
  }

  @Delete('me/sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeMySession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const session = await this.sessions.findById(id);
    if (!session || session.userId !== user.id) return; // don't leak existence of other users' sessions
    await this.sessions.revoke(id);
  }
}
