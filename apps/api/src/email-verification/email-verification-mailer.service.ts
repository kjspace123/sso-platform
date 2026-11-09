import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Env } from '@sso-platform/config';
import { ENV } from '../config/env.module';
import { SmtpMailerService } from '../mail/smtp-mailer.service';

@Injectable()
export class EmailVerificationMailerService {
  private readonly logger = new Logger(EmailVerificationMailerService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly smtp: SmtpMailerService,
  ) {}

  async send(email: string, token: string): Promise<void> {
    const verificationUrl = new URL('/verify-email', this.env.SSO_BASE_URL);
    verificationUrl.searchParams.set('token', token);

    if (!this.smtp.isConfigured) {
      if (this.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `[dev] Email verification link for ${email}: ${verificationUrl.toString()}`,
        );
        return;
      }
      throw new Error('SMTP is not configured');
    }

    await this.smtp.send({
      to: email,
      subject: 'Verify your SSO email address',
      text: `Verify your email address using this link. It expires in 24 hours:\n\n${verificationUrl.toString()}\n\nIf you did not create or update this account, you can ignore this message.`,
    });
  }
}
