import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Admin, AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';

@Injectable()
export class MerchantAssignService {
  constructor(private readonly prisma: PrismaService) {}

  async batchAssignAdmins(
    merchantIds: number[],
    adminIds: number[],
    operator: CurrentUser,
  ) {
    const uniqueMerchantIds = [...new Set(merchantIds)];
    const uniqueAdminIds = [...new Set(adminIds)];

    if (uniqueMerchantIds.length !== merchantIds.length) {
      throw new BadRequestException('merchantIds 存在重复项');
    }
    if (uniqueAdminIds.length !== adminIds.length) {
      throw new BadRequestException('adminIds 存在重复项');
    }

    await this.ensureMerchantsAssignable(uniqueMerchantIds, operator);
    await this.ensureTargetAdminsAssignable(uniqueAdminIds, operator);

    const existingRelations = await this.prisma.merchantAdmin.findMany({
      where: {
        merchantId: { in: uniqueMerchantIds },
        adminId: { in: uniqueAdminIds },
      },
      select: { merchantId: true, adminId: true },
    });
    const existingKeySet = new Set(
      existingRelations.map((item) => `${item.merchantId}-${item.adminId}`),
    );

    const toCreate: Array<{ merchantId: number; adminId: number; assignedBy: number }> = [];
    for (const merchantId of uniqueMerchantIds) {
      for (const adminId of uniqueAdminIds) {
        if (!existingKeySet.has(`${merchantId}-${adminId}`)) {
          toCreate.push({ merchantId, adminId, assignedBy: operator.id });
        }
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.$transaction([
        this.prisma.merchantAdmin.createMany({
          data: toCreate,
          skipDuplicates: true,
        }),
        this.prisma.operationLog.create({
          data: {
            module: 'MERCHANT_ASSIGN',
            action: 'BATCH_ASSIGN_ADMINS',
            targetType: 'MERCHANT',
            operatorId: operator.id,
            operatorName: operator.name,
            afterData: {
              merchantIds: uniqueMerchantIds,
              adminIds: uniqueAdminIds,
              createdCount: toCreate.length,
            } as Prisma.InputJsonValue,
          },
        }),
      ]);
    }

    const totalPairs = uniqueMerchantIds.length * uniqueAdminIds.length;
    const createdCount = toCreate.length;
    return {
      merchantCount: uniqueMerchantIds.length,
      adminCount: uniqueAdminIds.length,
      totalPairs,
      createdCount,
      skippedCount: totalPairs - createdCount,
    };
  }

  async getMerchantAdmins(merchantId: number, operator: CurrentUser) {
    await this.ensureMerchantAssignable(merchantId, operator);

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
    await this.ensureMerchantAssignable(merchantId, operator);
    const uniqueAdminIds = [...new Set(adminIds)];
    if (uniqueAdminIds.length !== adminIds.length) {
      throw new BadRequestException('adminIds 存在重复项');
    }

    await this.ensureTargetAdminsAssignable(uniqueAdminIds, operator);

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

    return this.getMerchantAdmins(merchantId, operator);
  }

  async unassignAdmin(
    merchantId: number,
    adminId: number,
    operator: CurrentUser,
  ) {
    await this.ensureMerchantAssignable(merchantId, operator);
    const relation = await this.prisma.merchantAdmin.findFirst({
      where: { merchantId, adminId },
      include: {
        admin: true,
      },
    });
    if (!relation) {
      throw new NotFoundException('分配关系不存在');
    }
    await this.ensureTargetAdminAssignable(relation.admin, operator);

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

  async getAdminMerchants(adminId: number, operator: CurrentUser) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    if (admin.role !== AdminRole.NORMAL) {
      throw new BadRequestException('仅支持查询普通管理员负责商家');
    }
    await this.ensureTargetAdminAssignable(admin, operator);

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

  private async ensureMerchantsAssignable(
    merchantIds: number[],
    operator: CurrentUser,
  ) {
    for (const merchantId of merchantIds) {
      await this.ensureMerchantAssignable(merchantId, operator);
    }
  }

  private async ensureMerchantAssignable(
    merchantId: number,
    operator: CurrentUser,
  ) {
    await this.ensureMerchantExists(merchantId);

    if (operator.role === AdminRole.SUPER) {
      return;
    }

    const relation = await this.prisma.merchantAdmin.findFirst({
      where: { merchantId, adminId: operator.id },
    });
    if (!relation) {
      throw new ForbiddenException('只能分配自己负责的商家');
    }
  }

  private async ensureTargetAdminsAssignable(
    adminIds: number[],
    operator: CurrentUser,
  ) {
    const admins = await this.prisma.admin.findMany({
      where: { id: { in: adminIds } },
    });
    if (admins.length !== adminIds.length) {
      throw new BadRequestException('存在无效的管理员 ID');
    }

    for (const admin of admins) {
      await this.ensureTargetAdminAssignable(admin, operator);
    }
  }

  private async ensureTargetAdminAssignable(admin: Admin, operator: CurrentUser) {
    if (admin.role !== AdminRole.NORMAL) {
      throw new BadRequestException('只能分配普通管理员');
    }

    if (operator.role === AdminRole.SUPER) {
      return;
    }

    if (admin.parentAdminId !== operator.id) {
      throw new ForbiddenException('只能将商家分配给自己的子管理员');
    }
  }
}
