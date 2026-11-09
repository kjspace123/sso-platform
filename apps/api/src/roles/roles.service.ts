import { Injectable, NotFoundException } from '@nestjs/common';
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
    await this.findByIdOrThrow(id);
    await this.prisma.role.update({
      where: { id },
      data: { name: input.name, description: input.description },
    });
    if (input.permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (input.permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: input.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          skipDuplicates: true,
        });
      }
    }
    return this.findByIdOrThrow(id);
  }

  async assignToUser(userId: string, roleId: string) {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async removeFromUser(userId: string, roleId: string) {
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
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
