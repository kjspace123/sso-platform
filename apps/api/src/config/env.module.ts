import { Global, Module } from '@nestjs/common';
import { loadEnv } from '@sso-platform/config';

export const ENV = Symbol('ENV');

/**
 * Loads and validates process.env once at boot (see @sso-platform/config).
 * Fails fast with a clear error if required variables are missing —
 * we never want a misconfigured identity provider to start silently.
 */
@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => loadEnv(process.env),
    },
  ],
  exports: [ENV],
})
export class EnvModule {}
