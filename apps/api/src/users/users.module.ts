import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { OidcModule } from '../oidc/oidc.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SessionsModule, OidcModule, AuthModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
