import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { EmailVerificationMailerService } from './email-verification-mailer.service';
import { EmailVerificationService } from './email-verification.service';

@Module({
  imports: [MailModule],
  providers: [EmailVerificationService, EmailVerificationMailerService],
  exports: [EmailVerificationService, EmailVerificationMailerService],
})
export class EmailVerificationModule {}
