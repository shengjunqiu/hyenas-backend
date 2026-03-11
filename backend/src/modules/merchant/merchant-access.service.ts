import { ForbiddenException, Injectable } from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';

export type MerchantAccessLevel = 'FULL' | 'STATUS_ONLY' | 'NONE';

@Injectable()
export class MerchantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  buildAccessibleWhere(user: CurrentUser): Prisma.MerchantWhereInput {
    if (user.role === AdminRole.SUPER) {
      return {};
    }

    if (user.role === AdminRole.SUB_ADMIN) {
      return {
        subAdmins: {
          some: {
            subAdminId: user.id,
          },
        },
      };
    }

    return {
      admins: {
        some: {
          adminId: user.id,
        },
      },
    };
  }

  async getAccessLevel(
    merchantId: number,
    user: CurrentUser,
  ): Promise<MerchantAccessLevel> {
    if (user.role === AdminRole.SUPER) {
      return 'FULL';
    }

    if (user.role === AdminRole.SUB_ADMIN) {
      const relation = await this.prisma.subAdminMerchant.findFirst({
        where: {
          merchantId,
          subAdminId: user.id,
        },
      });
      return relation ? 'STATUS_ONLY' : 'NONE';
    }

    const relation = await this.prisma.merchantAdmin.findFirst({
      where: {
        merchantId,
        adminId: user.id,
      },
    });
    return relation ? 'FULL' : 'NONE';
  }

  async ensureReadableAccess(merchantId: number, user: CurrentUser) {
    const level = await this.getAccessLevel(merchantId, user);
    if (level === 'NONE') {
      throw new ForbiddenException('无访问权限');
    }
    return level;
  }

  async ensureFullAccess(merchantId: number, user: CurrentUser) {
    const level = await this.getAccessLevel(merchantId, user);
    if (level !== 'FULL') {
      throw new ForbiddenException('无访问权限');
    }
    return level;
  }

  async ensureStatusAccess(merchantId: number, user: CurrentUser) {
    const level = await this.getAccessLevel(merchantId, user);
    if (level === 'NONE') {
      throw new ForbiddenException('无访问权限');
    }
    return level;
  }
}
