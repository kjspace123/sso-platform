import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@sso-platform/validation';
import type { Env } from '@sso-platform/config';
import { ENV } from '../config/env.module';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { requestContext } from '../common/http/request-context';
import { setSsoSessionCookie } from '../common/http/sso-session-cookie';
import { AuthService } from '../auth/auth.service';
import { OidcProviderService } from './oidc-provider.service';

/**
 * Backs the SSO web app's /login and /consent pages when they're reached as
 * part of an OIDC interaction (section 19 Phase 4). oidc-provider owns the
 * protocol state (its own interaction/session cookies); these endpoints
 * only translate that state into JSON the frontend can render, and translate
 * the frontend's form submissions back into oidc-provider's interaction
 * result API. Every endpoint is @Public() — auth here comes entirely from
 * oidc-provider's own interaction cookie, not our SessionAuthGuard.
 */
@ApiTags('oidc')
@Controller('oidc/interaction')
export class InteractionController {
  constructor(
    private readonly oidc: OidcProviderService,
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get(':uid')
  async details(@Param('uid') _uid: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const provider = this.oidc.provider;
    const interaction = await provider.interactionDetails(req, res);

    const clientId = interaction.params.client_id as string | undefined;
    const client = clientId ? await provider.Client.find(clientId) : undefined;

    return {
      uid: interaction.uid,
      prompt: interaction.prompt,
      params: interaction.params,
      client: client ? { clientId: client.clientId, name: client.clientName ?? client.clientId } : undefined,
    };
  }

  @Public()
  @Post(':uid/login')
  async login(
    @Param('uid') _uid: string,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const provider = this.oidc.provider;
    const ctx = requestContext(req);

    // Reuses the same credential validation, login-attempt throttling, and
    // audit logging as a direct /auth/login (section 16) — an OIDC login
    // prompt is not a weaker path than the SSO web app's own login form.
    const session = await this.auth.login(body.email, body.password, ctx);
    setSsoSessionCookie(res, session.token, this.env);

    const redirectTo = await provider.interactionResult(
      req,
      res,
      { login: { accountId: session.userId } },
      { mergeWithLastSubmission: false },
    );

    return { redirectTo };
  }

  @Public()
  @Post(':uid/register')
  async register(
    @Param('uid') _uid: string,
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.register(body.email, body.password, requestContext(req));
    setSsoSessionCookie(res, session.token, this.env);
    const redirectTo = await this.oidc.provider.interactionResult(
      req,
      res,
      { login: { accountId: session.userId } },
      { mergeWithLastSubmission: false },
    );
    return { redirectTo };
  }

  @Public()
  @Post(':uid/confirm')
  async confirm(@Param('uid') _uid: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const provider = this.oidc.provider;
    const interaction = await provider.interactionDetails(req, res);

    const accountId = interaction.session?.accountId ?? (interaction.result?.login?.accountId as string | undefined);
    const clientId = interaction.params.client_id as string;
    if (!accountId) {
      const redirectTo = await provider.interactionResult(
        req,
        res,
        { error: 'access_denied', error_description: 'No active login for this interaction' },
        { mergeWithLastSubmission: false },
      );
      return { redirectTo };
    }

    const grant = interaction.grantId
      ? ((await provider.Grant.find(interaction.grantId)) ?? new provider.Grant({ accountId, clientId }))
      : new provider.Grant({ accountId, clientId });

    const details = interaction.prompt.details as {
      missingOIDCScope?: string[];
      missingOIDCClaims?: string[];
    };
    if (details.missingOIDCScope?.length) grant.addOIDCScope(details.missingOIDCScope);
    if (details.missingOIDCClaims?.length) grant.addOIDCClaims(details.missingOIDCClaims);

    const grantId = await grant.save();

    const redirectTo = await provider.interactionResult(
      req,
      res,
      { consent: { grantId } },
      { mergeWithLastSubmission: true },
    );

    return { redirectTo };
  }

  @Public()
  @Post(':uid/abort')
  async abort(@Param('uid') _uid: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const provider = this.oidc.provider;
    const redirectTo = await provider.interactionResult(
      req,
      res,
      { error: 'access_denied', error_description: 'End-User declined to authorize the application' },
      { mergeWithLastSubmission: false },
    );
    return { redirectTo };
  }
}
