import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailVerificationModule } from '../email-verification/email-verification.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordResetThrottleService } from './password-reset-throttle.service';
import { PasswordService } from './password.service';

@Module({
  imports: [SessionsModule, PasswordResetModule, EmailVerificationModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, LoginThrottleService, PasswordResetThrottleService],
  exports: [AuthService, PasswordService],
})
export class AuthModule {}
