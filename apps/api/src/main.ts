import 'reflect-metadata';
// Loads apps/api/.env when present. In Docker, compose's `env_file` already
// populates process.env, and dotenv never overwrites existing values.
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { loadEnv } from '@sso-platform/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const env = loadEnv(process.env);

  // bufferLogs holds any log calls made before useLogger() below runs, then
  // flushes them through pino instead of dropping them / printing via
  // Nest's default console logger.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  // Structured (JSON) logging (section 25/LoggingModule) — every existing
  // `new Logger(ClassName)` call across the codebase now routes through
  // pino without needing to change, since this rebinds Nest's Logger
  // globally rather than requiring per-file changes.
  app.useLogger(app.get(PinoLogger));

  await configureApp(app, env);

  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap();
