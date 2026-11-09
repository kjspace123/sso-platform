import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { PublicUser } from '@sso-platform/types';
import type { User, UserRole, Role } from '@prisma/client';

type UserWithRoles = User & { roles: (UserRole & { role: Role })[] };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(id: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, data: { email?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  toPublic(user: UserWithRoles): PublicUser {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      roles: user.roles.map((r) => r.role.name),
    };
  }
}
