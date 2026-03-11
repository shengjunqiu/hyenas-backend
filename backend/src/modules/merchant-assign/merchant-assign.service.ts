import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, MerchantPermissionScope, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { MerchantAccessService } from '../merchant/merchant-access.service';

@Injectable()
export class MerchantAssignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccessService: MerchantAccessService,
  ) {}

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

    const merchants = await this.prisma.merchant.findMany({
      where: {
        id: { in: uniqueMerchantIds },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (merchants.length !== uniqueMerchantIds.length) {
      throw new BadRequestException('存在无效的商家 ID');
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
        merchantId: { in: uniqueMerchantIds },
        adminId: { in: uniqueAdminIds },
      },
      select: { merchantId: true, adminId: true },
    });
    const existingKeySet = new Set(
      existingRelations.map((item) => `${item.merchantId}-${item.adminId}`),
    );

    const toCreate: Array<{
      merchantId: number;
      adminId: number;
      assignedBy: number;
    }> = [];
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
      this.prisma.subAdminMerchant.deleteMany({
        where: {
          merchantId,
          parentAdminId: adminId,
        },
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

  async getMerchantSubAdmins(merchantId: number, operator: CurrentUser) {
    await this.ensureMerchantOwnedByOperator(merchantId, operator);

    return this.prisma.subAdminMerchant.findMany({
      where: {
        merchantId,
        parentAdminId: operator.id,
      },
      include: {
        subAdmin: {
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            role: true,
            status: true,
            parentAdminId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignSubAdmins(
    merchantId: number,
    subAdminIds: number[],
    operator: CurrentUser,
  ) {
    await this.ensureMerchantOwnedByOperator(merchantId, operator);
    const uniqueSubAdminIds = [...new Set(subAdminIds)];
    if (uniqueSubAdminIds.length !== subAdminIds.length) {
      throw new BadRequestException('adminIds 存在重复项');
    }

    const subAdmins = await this.prisma.admin.findMany({
      where: {
        id: { in: uniqueSubAdminIds },
        role: AdminRole.SUB_ADMIN,
        parentAdminId: operator.id,
      },
    });
    if (subAdmins.length !== uniqueSubAdminIds.length) {
      throw new BadRequestException('存在无效的子管理员 ID');
    }

    const existingRelations = await this.prisma.subAdminMerchant.findMany({
      where: {
        merchantId,
        subAdminId: { in: uniqueSubAdminIds },
      },
      select: { subAdminId: true },
    });
    if (existingRelations.length > 0) {
      const duplicatedIds = existingRelations.map((item) => item.subAdminId);
      throw new BadRequestException(
        `子管理员已分配，不可重复分配: ${duplicatedIds.join(',')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.subAdminMerchant.createMany({
        data: uniqueSubAdminIds.map((subAdminId) => ({
          merchantId,
          subAdminId,
          parentAdminId: operator.id,
          assignedBy: operator.id,
          permissionScope: MerchantPermissionScope.STATUS_CHANGE,
        })),
      }),
      this.prisma.operationLog.create({
        data: {
          module: 'MERCHANT_ASSIGN',
          action: 'ASSIGN_SUB_ADMINS',
          targetType: 'MERCHANT',
          targetId: merchantId,
          operatorId: operator.id,
          operatorName: operator.name,
          afterData: {
            subAdminIds: uniqueSubAdminIds,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);

    return this.getMerchantSubAdmins(merchantId, operator);
  }

  async batchAssignSubAdmins(
    merchantIds: number[],
    subAdminIds: number[],
    operator: CurrentUser,
  ) {
    const uniqueMerchantIds = [...new Set(merchantIds)];
    const uniqueSubAdminIds = [...new Set(subAdminIds)];

    if (uniqueMerchantIds.length !== merchantIds.length) {
      throw new BadRequestException('merchantIds 存在重复项');
    }
    if (uniqueSubAdminIds.length !== subAdminIds.length) {
      throw new BadRequestException('adminIds 存在重复项');
    }

    const merchants = await this.prisma.merchant.findMany({
      where: {
        id: { in: uniqueMerchantIds },
        deletedAt: null,
        ...this.merchantAccessService.buildAccessibleWhere(operator),
      },
      select: { id: true },
    });
    if (merchants.length !== uniqueMerchantIds.length) {
      throw new BadRequestException('存在无效的商家 ID 或无分配权限');
    }

    const subAdmins = await this.prisma.admin.findMany({
      where: {
        id: { in: uniqueSubAdminIds },
        role: AdminRole.SUB_ADMIN,
        parentAdminId: operator.id,
      },
    });
    if (subAdmins.length !== uniqueSubAdminIds.length) {
      throw new BadRequestException('存在无效的子管理员 ID');
    }

    const existingRelations = await this.prisma.subAdminMerchant.findMany({
      where: {
        merchantId: { in: uniqueMerchantIds },
        subAdminId: { in: uniqueSubAdminIds },
        parentAdminId: operator.id,
      },
      select: { merchantId: true, subAdminId: true },
    });
    const existingKeySet = new Set(
      existingRelations.map((item) => `${item.merchantId}-${item.subAdminId}`),
    );

    const toCreate: Array<{
      merchantId: number;
      subAdminId: number;
      parentAdminId: number;
      assignedBy: number;
      permissionScope: MerchantPermissionScope;
    }> = [];

    for (const merchantId of uniqueMerchantIds) {
      for (const subAdminId of uniqueSubAdminIds) {
        if (!existingKeySet.has(`${merchantId}-${subAdminId}`)) {
          toCreate.push({
            merchantId,
            subAdminId,
            parentAdminId: operator.id,
            assignedBy: operator.id,
            permissionScope: MerchantPermissionScope.STATUS_CHANGE,
          });
        }
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.$transaction([
        this.prisma.subAdminMerchant.createMany({
          data: toCreate,
          skipDuplicates: true,
        }),
        this.prisma.operationLog.create({
          data: {
            module: 'MERCHANT_ASSIGN',
            action: 'BATCH_ASSIGN_SUB_ADMINS',
            targetType: 'MERCHANT',
            operatorId: operator.id,
            operatorName: operator.name,
            afterData: {
              merchantIds: uniqueMerchantIds,
              subAdminIds: uniqueSubAdminIds,
              createdCount: toCreate.length,
            } as Prisma.InputJsonValue,
          },
        }),
      ]);
    }

    const totalPairs = uniqueMerchantIds.length * uniqueSubAdminIds.length;
    const createdCount = toCreate.length;
    return {
      merchantCount: uniqueMerchantIds.length,
      adminCount: uniqueSubAdminIds.length,
      totalPairs,
      createdCount,
      skippedCount: totalPairs - createdCount,
    };
  }

  async unassignSubAdmin(
    merchantId: number,
    subAdminId: number,
    operator: CurrentUser,
  ) {
    await this.ensureMerchantOwnedByOperator(merchantId, operator);

    const relation = await this.prisma.subAdminMerchant.findFirst({
      where: {
        merchantId,
        subAdminId,
        parentAdminId: operator.id,
      },
    });
    if (!relation) {
      throw new NotFoundException('子管理员分配关系不存在');
    }

    await this.prisma.$transaction([
      this.prisma.subAdminMerchant.delete({
        where: { id: relation.id },
      }),
      this.prisma.operationLog.create({
        data: {
          module: 'MERCHANT_ASSIGN',
          action: 'UNASSIGN_SUB_ADMIN',
          targetType: 'MERCHANT',
          targetId: merchantId,
          operatorId: operator.id,
          operatorName: operator.name,
          beforeData: { subAdminId } as Prisma.InputJsonValue,
        },
      }),
    ]);

    return null;
  }

  async getSubAdminMerchants(subAdminId: number, operator: CurrentUser) {
    const subAdmin = await this.prisma.admin.findFirst({
      where: {
        id: subAdminId,
        role: AdminRole.SUB_ADMIN,
        parentAdminId: operator.id,
      },
    });
    if (!subAdmin) {
      throw new NotFoundException('子管理员不存在');
    }

    const relations = await this.prisma.subAdminMerchant.findMany({
      where: {
        subAdminId,
        parentAdminId: operator.id,
      },
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
        permissionScope: item.permissionScope,
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

  private async ensureMerchantOwnedByOperator(
    merchantId: number,
    operator: CurrentUser,
  ) {
    await this.ensureMerchantExists(merchantId);
    await this.merchantAccessService.ensureFullAccess(merchantId, operator);
  }
}
