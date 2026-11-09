import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@sso-platform/types';

const REDACTED_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'refreshToken',
  'accessToken',
  'idToken',
  'clientSecret',
  'secret',
  'cookie',
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, REDACTED_KEYS.has(k) ? '[REDACTED]' : redact(v)]),
    );
  }
  return value;
}

/** Uniform error envelope + redaction of sensitive values before they ever hit a log (section 25). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : undefined;

    const message =
      typeof body === 'object' && body && 'message' in body
        ? (body as { message: string | string[] }).message
        : isHttp
          ? exception.message
          : 'Internal server error';

    const errorBody: ApiErrorBody = {
      statusCode,
      error: isHttp ? exception.name : 'InternalServerError',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      this.logger.error(redact({ path: request.url, exception: `${exception}` }));
    }

    response.status(statusCode).json(errorBody);
  }
}
