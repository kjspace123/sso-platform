import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { PublicUser } from '@sso-platform/types';
import type { Permission, Role, RolePermission, User, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

type UserWithRoles = User & {
  roles: (UserRole & { role: Role & { permissions: (RolePermission & { permission: Permission })[] } })[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(id: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, data: { email?: string }) {
    const current = await this.prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!current) throw new NotFoundException('User not found');
    const emailChanged = data.email !== undefined && data.email !== current.email;
    if (emailChanged && await this.prisma.user.findUnique({ where: { email: data.email } })) {
      throw new ConflictException('An account with this email already exists');
    }
    try {
      return await this.prisma.user.update({
        where: { id },
        // Login and password recovery continue using the current address until
        // the replacement is verified. Submitting the current address cancels it.
        data: data.email === undefined ? {} : { pendingEmail: emailChanged ? data.email : null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async assertCanManage(id: string, actor: AuthenticatedUser): Promise<UserWithRoles> {
    const target = await this.findByIdOrThrow(id);
    const permissions = this.toPublic(target).permissions;
    if (permissions.some((permission) => !actor.permissions.includes(permission))) {
      throw new ForbiddenException('Cannot manage an account with permissions you do not have');
    }
    return target;
  }

  toPublic(user: UserWithRoles): PublicUser {
    return {
      id: user.id,
      email: user.email,
      pendingEmail: user.pendingEmail,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      roles: user.roles.map((r) => r.role.name),
      permissions: [
        ...new Set(user.roles.flatMap((userRole) => userRole.role.permissions.map((item) => item.permission.name))),
      ],
    };
  }
}
