import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CreateRoleInput, UpdateRoleInput } from '@sso-platform/validation';
import type { PublicRole } from '@sso-platform/types';
import type { Role, RolePermission, Permission } from '@prisma/client';

type RoleWithPermissions = Role & { permissions: (RolePermission & { permission: Permission })[] };

const include = { permissions: { include: { permission: true } } } as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.role.findMany({ include, orderBy: { name: 'asc' } });
  }

  async findByIdOrThrow(id: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({ where: { id }, include });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(input: CreateRoleInput) {
    const role = await this.prisma.role.create({ data: { name: input.name, description: input.description } });
    if (input.permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
    return this.findByIdOrThrow(role.id);
  }

  async update(id: string, input: UpdateRoleInput) {
    const current = await this.findByIdOrThrow(id);
    if (current.name === 'super-admin') {
      if (input.name && input.name !== current.name) {
        throw new BadRequestException('The built-in super-admin role cannot be renamed');
      }
      if (input.permissionIds) {
        const requestedPermissionIds = new Set(input.permissionIds);
        const [permissionCount, requestedPermissionCount] = await Promise.all([
          this.prisma.permission.count(),
          this.prisma.permission.count({ where: { id: { in: [...requestedPermissionIds] } } }),
        ]);
        if (requestedPermissionIds.size !== permissionCount || requestedPermissionCount !== permissionCount) {
          throw new BadRequestException('The built-in super-admin role must retain every permission');
        }
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { name: input.name, description: input.description },
      });
      if (input.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (input.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: input.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
            skipDuplicates: true,
          });
        }
      }
    });
    return this.findByIdOrThrow(id);
  }

  async setForUser(userId: string, roleIds: string[]) {
    const uniqueRoleIds = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({ where: { id: { in: uniqueRoleIds } }, select: { id: true } });
    if (roles.length !== uniqueRoleIds.length) throw new BadRequestException('One or more roles do not exist');

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      if (uniqueRoleIds.length > 0) {
        await tx.userRole.createMany({ data: uniqueRoleIds.map((roleId) => ({ userId, roleId })) });
      }
    });
  }

  toPublic(role: RoleWithPermissions): PublicRole {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((p) => p.permission.name),
    };
  }
}
