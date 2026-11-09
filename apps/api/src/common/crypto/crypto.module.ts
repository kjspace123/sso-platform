import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/env.module';
import type { Env } from '@sso-platform/config';
import { SecretCipher } from './secret-cipher';

export const SECRET_CIPHER = Symbol('SECRET_CIPHER');

@Global()
@Module({
  providers: [
    {
      provide: SECRET_CIPHER,
      useFactory: (env: Env) => new SecretCipher(env.CLIENT_SECRET_ENCRYPTION_KEY),
      inject: [ENV],
    },
  ],
  exports: [SECRET_CIPHER],
})
export class CryptoModule {}
