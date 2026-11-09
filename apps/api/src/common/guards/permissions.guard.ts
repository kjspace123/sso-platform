import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

/** Enforces @RequirePermission(). Runs after SessionAuthGuard has populated request.user. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !user.permissions.includes(required)) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }
    return true;
  }
}
