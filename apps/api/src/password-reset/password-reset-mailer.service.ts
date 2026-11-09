import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Env } from '@sso-platform/config';
import { ENV } from '../config/env.module';
import { SmtpMailerService } from '../mail/smtp-mailer.service';

@Injectable()
export class PasswordResetMailerService {
  private readonly logger = new Logger(PasswordResetMailerService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly smtp: SmtpMailerService,
  ) {}

  async send(email: string, token: string): Promise<void> {
    const resetUrl = new URL('/reset-password', this.env.SSO_BASE_URL);
    resetUrl.searchParams.set('token', token);

    if (!this.smtp.isConfigured) {
      if (this.env.NODE_ENV !== 'production') {
        this.logger.warn(`[dev] Password reset link for ${email}: ${resetUrl.toString()}`);
        return;
      }
      throw new Error('SMTP is not configured');
    }

    await this.smtp.send({
      to: email,
      subject: 'Reset your SSO password',
      text: `Use this link to reset your password. It expires in 30 minutes:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this message.`,
    });
  }
}
