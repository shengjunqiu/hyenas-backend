import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';

@Injectable()
export class MerchantAssignService {
  constructor(private readonly prisma: PrismaService) {}

  async getMerchantAdmins(merchantId: number) {
    await this.ensureMerchantExists(merchantId);

    const relations = await this.prisma.merchantAdmin.findMany({
      where: { merchantId },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            role: true,
            status: true,
          },
        },
        assigner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return relations;
  }

  async assignAdmins(
    merchantId: number,
    adminIds: number[],
    operator: CurrentUser,
  ) {
    await this.ensureMerchantExists(merchantId);
    const uniqueAdminIds = [...new Set(adminIds)];
    if (uniqueAdminIds.length !== adminIds.length) {
      throw new BadRequestException('adminIds 存在重复项');
    }

    const admins = await this.prisma.admin.findMany({
      where: { id: { in: uniqueAdminIds } },
    });
    if (admins.length !== uniqueAdminIds.length) {
      throw new BadRequestException('存在无效的管理员 ID');
    }

    const invalid = admins.find((item) => item.role !== AdminRole.NORMAL);
    if (invalid) {
      throw new BadRequestException('只能分配普通管理员');
    }

    const existingRelations = await this.prisma.merchantAdmin.findMany({
      where: {
        merchantId,
        adminId: { in: uniqueAdminIds },
      },
      select: { adminId: true },
    });
    if (existingRelations.length > 0) {
      const duplicatedIds = existingRelations.map((item) => item.adminId);
      throw new BadRequestException(
        `管理员已分配，不可重复分配: ${duplicatedIds.join(',')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.merchantAdmin.createMany({
        data: uniqueAdminIds.map((adminId) => ({
          merchantId,
          adminId,
          assignedBy: operator.id,
        })),
      }),
      this.prisma.operationLog.create({
        data: {
          module: 'MERCHANT_ASSIGN',
          action: 'ASSIGN_ADMINS',
          targetType: 'MERCHANT',
          targetId: merchantId,
          operatorId: operator.id,
          operatorName: operator.name,
          afterData: {
            adminIds: uniqueAdminIds,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);

    return this.getMerchantAdmins(merchantId);
  }

  async unassignAdmin(
    merchantId: number,
    adminId: number,
    operator: CurrentUser,
  ) {
    await this.ensureMerchantExists(merchantId);
    const relation = await this.prisma.merchantAdmin.findFirst({
      where: { merchantId, adminId },
    });
    if (!relation) {
      throw new NotFoundException('分配关系不存在');
    }

    await this.prisma.$transaction([
      this.prisma.merchantAdmin.delete({
        where: { id: relation.id },
      }),
      this.prisma.operationLog.create({
        data: {
          module: 'MERCHANT_ASSIGN',
          action: 'UNASSIGN_ADMIN',
          targetType: 'MERCHANT',
          targetId: merchantId,
          operatorId: operator.id,
          operatorName: operator.name,
          beforeData: { adminId } as Prisma.InputJsonValue,
        },
      }),
    ]);

    return null;
  }

  async getAdminMerchants(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    if (admin.role !== AdminRole.NORMAL) {
      throw new BadRequestException('仅支持查询普通管理员负责商家');
    }

    const relations = await this.prisma.merchantAdmin.findMany({
      where: { adminId },
      include: {
        merchant: {
          include: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return relations
      .filter((item) => !item.merchant.deletedAt)
      .map((item) => ({
        assignedAt: item.createdAt,
        merchant: item.merchant,
      }));
  }

  private async ensureMerchantExists(merchantId: number) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, deletedAt: null },
    });
    if (!merchant) {
      throw new NotFoundException('商家不存在');
    }
    return merchant;
  }
}
