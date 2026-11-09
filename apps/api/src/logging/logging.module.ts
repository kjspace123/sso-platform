import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '@sso-platform/config';
import { ENV } from '../config/env.module';

/**
 * Structured (JSON) logging via pino, swapped in for Nest's default
 * plain-text console Logger (section 25). Every existing `new
 * Logger(ClassName)` call across the codebase keeps working unchanged —
 * `app.useLogger(app.get(Logger))` in main.ts is what redirects Nest's
 * built-in Logger through pino, so no call sites needed to change.
 *
 * autoLogging is disabled because LoggingInterceptor already logs one line
 * per request (and deliberately never logs bodies) — leaving pino-http's
 * own request/response auto-logger on would double every request's log
 * line. genReqId reuses an inbound X-Request-Id (useful behind a proxy that
 * already assigns one) and otherwise generates a uuid; LoggingInterceptor
 * and AllExceptionsFilter both read req.id so a single request's log lines
 * and its error response can be correlated by that id.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          autoLogging: false,
          genReqId: (req: { headers: Record<string, string | string[] | undefined> }) => {
            const header = req.headers['x-request-id'];
            return typeof header === 'string' && header ? header : crypto.randomUUID();
          },
          redact: {
            paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
            censor: '[REDACTED]',
          },
          // Pretty-print in dev for a human reading a terminal; plain
          // newline-delimited JSON in production for log aggregators.
          transport:
            env.NODE_ENV === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
