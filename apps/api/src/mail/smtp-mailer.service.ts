import { Inject, Injectable } from '@nestjs/common';
import type { Env } from '@sso-platform/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../config/env.module';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

/** Shared SMTP transport so identity emails use one validated configuration. */
@Injectable()
export class SmtpMailerService {
  private readonly transporter?: Transporter;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      });
    }
  }

  get isConfigured(): boolean {
    return !!this.transporter && !!this.env.SMTP_FROM;
  }

  async send(input: SendMailInput): Promise<void> {
    if (!this.transporter || !this.env.SMTP_FROM) throw new Error('SMTP is not configured');
    await this.transporter.sendMail({ from: this.env.SMTP_FROM, ...input });
  }
}
