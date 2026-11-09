import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EnvModule } from './config/env.module';
import { LoggingModule } from './logging/logging.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './database/redis.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { SecurityModule } from './security/security.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SessionsModule } from './sessions/sessions.module';
import { ApplicationsModule } from './applications/applications.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditModule } from './audit/audit.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { OidcModule } from './oidc/oidc.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    EnvModule,
    LoggingModule,
    DatabaseModule,
    RedisModule,
    CryptoModule,
    SecurityModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SessionsModule,
    ApplicationsModule,
    RolesModule,
    PermissionsModule,
    AuditModule,
    PasswordResetModule,
    AdminModule,
    OidcModule,
  ],
  providers: [
    // Every route requires a valid SSO session unless annotated @Public().
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    // Runs after SessionAuthGuard; enforces @RequirePermission() (section 14).
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
