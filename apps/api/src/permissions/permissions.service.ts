import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { PublicPermission } from '@sso-platform/types';
import type { Permission } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.permission.findMany({ orderBy: { name: 'asc' } });
  }

  toPublic(permission: Permission): PublicPermission {
    return { id: permission.id, name: permission.name, description: permission.description };
  }
}
