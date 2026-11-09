import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs';

/** Logs method/path/status/duration for every request. Never logs bodies (section 25). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${request.method} ${request.url} +${Date.now() - start}ms`);
      }),
    );
  }
}
