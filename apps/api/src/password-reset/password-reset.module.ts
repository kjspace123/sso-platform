import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetMailerService } from './password-reset-mailer.service';

@Module({
  imports: [MailModule],
  providers: [PasswordResetService, PasswordResetMailerService],
  exports: [PasswordResetService, PasswordResetMailerService],
})
export class PasswordResetModule {}
