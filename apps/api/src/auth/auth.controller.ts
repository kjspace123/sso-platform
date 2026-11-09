import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@sso-platform/validation';
import type { Env } from '@sso-platform/config';
import { ENV } from '../config/env.module';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SSO_SESSION_COOKIE } from '../common/guards/session-auth.guard';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { requestContext } from '../common/http/request-context';
import { setSsoSessionCookie } from '../common/http/sso-session-cookie';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.register(body.email, body.password, requestContext(req));
    setSsoSessionCookie(res, session.id, this.env);
    return { id: session.id };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(body.email, body.password, requestContext(req));
    setSsoSessionCookie(res, session.id, this.env);
    return { id: session.id };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user.sessionId, user.id, requestContext(req));
    res.clearCookie(SSO_SESSION_COOKIE, { path: '/' });
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(user.id, user.sessionId, requestContext(req));
    res.clearCookie(SSO_SESSION_COOKIE, { path: '/' });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() req: Request,
  ) {
    await this.auth.forgotPassword(body.email, requestContext(req));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
  ) {
    await this.auth.resetPassword(body.token, body.password, requestContext(req));
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ) {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword, requestContext(req));
  }
}
