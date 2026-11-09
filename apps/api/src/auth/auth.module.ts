import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordService } from './password.service';

@Module({
  imports: [SessionsModule, PasswordResetModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, LoginThrottleService],
  exports: [AuthService, PasswordService],
})
export class AuthModule {}
