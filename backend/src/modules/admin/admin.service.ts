import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Admin, AdminRole, AdminStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateAdminDto } from './dto/create-admin.dto';
import { QueryAdminDto } from './dto/query-admin.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateAdminStatusDto } from './dto/update-admin-status.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getMerchantStatusStatistics(operator: CurrentUser) {
    const adminWhere: Prisma.AdminWhereInput = {
      role: AdminRole.NORMAL,
      createdById: operator.id,
    };
    const merchantWhere: Prisma.MerchantWhereInput = {
      deletedAt: null,
      admins: {
        some: {
          admin: adminWhere,
        },
      },
    };
    const [admins, totalMerchantCount, statuses, groupedCounts] =
      await this.prisma.$transaction([
        this.prisma.admin.findMany({
          where: adminWhere,
          orderBy: { createdAt: 'desc' },
          include: {
            merchantAdmins: {
              where: {
                merchant: {
                  deletedAt: null,
                },
              },
              select: {
                merchant: {
                  select: {
                    id: true,
                    statusId: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.merchant.count({
          where: merchantWhere,
        }),
        this.prisma.merchantStatus.findMany({
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.merchant.groupBy({
          by: ['statusId'],
          where: merchantWhere,
          orderBy: {
            statusId: 'asc',
          },
          _count: {
            statusId: true,
          },
        }),
      ]);

    const groupedCountMap = this.buildStatusCountMap(groupedCounts);
    const statusStats = this.buildStatusStats(
      statuses,
      groupedCountMap,
      totalMerchantCount,
    );
    const adminStats = admins
      .map((admin) => {
        const adminCountMap = new Map<number, number>();

        for (const relation of admin.merchantAdmins) {
          const count = adminCountMap.get(relation.merchant.statusId) ?? 0;
          adminCountMap.set(relation.merchant.statusId, count + 1);
        }

        const merchantCount = admin.merchantAdmins.length;

        return {
          adminId: admin.id,
          adminName: admin.name,
          username: admin.username,
          phone: admin.phone,
          status: admin.status,
          merchantCount,
          statusStats: this.buildStatusStats(
            statuses,
            adminCountMap,
            merchantCount,
          ),
        };
      })
      .sort((a, b) => b.merchantCount - a.merchantCount || a.adminId - b.adminId);

    return {
      totalAdminCount: admins.length,
      totalMerchantCount,
      statusStats,
      adminStats,
    };
  }

  async exportAdminGroupedMerchantStatusStatistics(operator: CurrentUser) {
    const statistics = await this.getMerchantStatusStatistics(operator);
    const workbook = XLSX.utils.book_new();
    const headerRow = ['管理员姓名', '登录账号', '手机号', '账号状态', '负责商家数'];

    for (const status of statistics.statusStats) {
      headerRow.push(`${status.statusName}数量`);
      headerRow.push(`${status.statusName}占比`);
    }

    const rows = statistics.adminStats.map((admin) => {
      const row: Array<string | number> = [
        admin.adminName,
        admin.username,
        admin.phone ?? '',
        admin.status === AdminStatus.ENABLED ? '启用' : '禁用',
        admin.merchantCount,
      ];

      for (const status of admin.statusStats) {
        row.push(status.merchantCount);
        row.push(`${(status.ratio * 100).toFixed(2)}%`);
      }

      return row;
    });

    const summaryRows: Array<Array<string | number>> = [
      ['所属管理员数', statistics.totalAdminCount],
      ['去重商家总数', statistics.totalMerchantCount],
      [],
      ['状态名称', '商家数量', '占比'],
      ...statistics.statusStats.map((status) => [
        status.statusName,
        status.merchantCount,
        `${(status.ratio * 100).toFixed(2)}%`,
      ]),
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    const detailSheet = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);

    XLSX.utils.book_append_sheet(workbook, summarySheet, '总体概览');
    XLSX.utils.book_append_sheet(workbook, detailSheet, '管理员分组统计');

    return {
      fileName: `admin-merchant-status-statistics-${this.formatExportTimestamp(new Date())}.xlsx`,
      buffer: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      }) as Buffer,
    };
  }

  async exportSingleAdminMerchantStatusStatistics(
    adminId: number,
    operator: CurrentUser,
  ) {
    const [admin, statuses] = await this.prisma.$transaction([
      this.prisma.admin.findFirst({
        where: {
          id: adminId,
          role: AdminRole.NORMAL,
          createdById: operator.id,
        },
        include: {
          merchantAdmins: {
            where: {
              merchant: {
                deletedAt: null,
              },
            },
            select: {
              merchant: {
                select: {
                  id: true,
                  name: true,
                  statusId: true,
                  status: {
                    select: {
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.merchantStatus.findMany({
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    const adminCountMap = new Map<number, number>();
    for (const relation of admin.merchantAdmins) {
      const count = adminCountMap.get(relation.merchant.statusId) ?? 0;
      adminCountMap.set(relation.merchant.statusId, count + 1);
    }

    const merchantCount = admin.merchantAdmins.length;
    const statusStats = this.buildStatusStats(statuses, adminCountMap, merchantCount);
    const workbook = XLSX.utils.book_new();

    const summaryRows: Array<Array<string | number>> = [
      ['管理员姓名', admin.name],
      ['登录账号', admin.username],
      ['手机号', admin.phone ?? ''],
      ['账号状态', admin.status === AdminStatus.ENABLED ? '启用' : '禁用'],
      ['负责商家数', merchantCount],
      [],
      ['状态名称', '商家数量', '占比'],
      ...statusStats.map((status) => [
        status.statusName,
        status.merchantCount,
        `${(status.ratio * 100).toFixed(2)}%`,
      ]),
    ];

    const merchantRows: Array<Array<string | number>> = [
      ['商家名称', '状态名称', '状态编码'],
      ...admin.merchantAdmins.map((relation) => [
        relation.merchant.name,
        relation.merchant.status.name,
        relation.merchant.status.code,
      ]),
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(summaryRows),
      '管理员概览',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(merchantRows),
      '负责商家明细',
    );

    return {
      fileName: `admin-${admin.id}-merchant-status-statistics-${this.formatExportTimestamp(new Date())}.xlsx`,
      buffer: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      }) as Buffer,
    };
  }

  async queryAdmins(query: QueryAdminDto) {
    const where = this.buildWhere(query, [AdminRole.SUPER, AdminRole.NORMAL]);
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, admins] = await this.prisma.$transaction([
      this.prisma.admin.count({ where }),
      this.prisma.admin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              merchantAdmins: true,
            },
          },
        },
      }),
    ]);

    return {
      list: admins.map((item) => ({
        id: item.id,
        username: item.username,
        name: item.name,
        phone: item.phone,
        role: item.role,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        merchantCount: item._count.merchantAdmins,
      })),
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async createAdmin(dto: CreateAdminDto, operator: CurrentUser) {
    if (dto.role === AdminRole.SUB_ADMIN) {
      throw new BadRequestException('子管理员请使用专用创建接口');
    }

    const existing = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.admin.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        status: AdminStatus.ENABLED,
        createdById: operator.id,
      },
    });

    await this.writeOperationLog({
      action: 'CREATE_ADMIN',
      operator,
      target: created,
      afterData: this.adminToSafeObject(created),
    });

    return this.adminToSafeObject(created);
  }

  async updateAdmin(id: number, dto: UpdateAdminDto, operator: CurrentUser) {
    const existing = await this.findAdminOrThrow(id);
    if (
      existing.role === AdminRole.SUB_ADMIN ||
      dto.role === AdminRole.SUB_ADMIN
    ) {
      throw new BadRequestException('子管理员请使用专用管理接口');
    }
    if (
      existing.role === AdminRole.SUPER &&
      dto.role === AdminRole.NORMAL &&
      (await this.countEnabledSuperAdmins()) <= 1
    ) {
      throw new BadRequestException('至少保留一个启用中的超级管理员');
    }

    const updated = await this.prisma.admin.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
      },
    });

    await this.writeOperationLog({
      action: 'UPDATE_ADMIN',
      operator,
      target: updated,
      beforeData: this.adminToSafeObject(existing),
      afterData: this.adminToSafeObject(updated),
    });

    return this.adminToSafeObject(updated);
  }

  async updateAdminStatus(
    id: number,
    dto: UpdateAdminStatusDto,
    operator: CurrentUser,
  ) {
    const existing = await this.findAdminOrThrow(id);

    if (
      existing.role === AdminRole.SUPER &&
      dto.status === AdminStatus.DISABLED &&
      (await this.countEnabledSuperAdmins()) <= 1
    ) {
      throw new BadRequestException('至少保留一个启用中的超级管理员');
    }

    const updated = await this.prisma.admin.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.writeOperationLog({
      action: 'UPDATE_ADMIN_STATUS',
      operator,
      target: updated,
      beforeData: this.adminToSafeObject(existing),
      afterData: this.adminToSafeObject(updated),
    });

    return this.adminToSafeObject(updated);
  }

  async resetPassword(
    id: number,
    dto: ResetPasswordDto,
    operator: CurrentUser,
  ) {
    const existing = await this.findAdminOrThrow(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.admin.update({
      where: { id },
      data: { passwordHash },
    });

    await this.writeOperationLog({
      action: 'RESET_ADMIN_PASSWORD',
      operator,
      target: existing,
      afterData: { reset: true },
    });

    return null;
  }

  async querySubAdmins(query: QueryAdminDto, operator: CurrentUser) {
    const where = this.buildWhere(query, [AdminRole.SUB_ADMIN]);
    where.parentAdminId = operator.id;
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, admins] = await this.prisma.$transaction([
      this.prisma.admin.count({ where }),
      this.prisma.admin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              subMerchantAssignments: true,
            },
          },
        },
      }),
    ]);

    return {
      list: admins.map((item) => ({
        ...this.adminToSafeObject(item),
        merchantCount: item._count.subMerchantAssignments,
      })),
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async createSubAdmin(
    dto: Omit<CreateAdminDto, 'role'>,
    operator: CurrentUser,
  ) {
    const existing = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.admin.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: AdminRole.SUB_ADMIN,
        status: AdminStatus.ENABLED,
        parentAdminId: operator.id,
        createdById: operator.id,
      },
    });

    await this.writeOperationLog({
      action: 'CREATE_SUB_ADMIN',
      operator,
      target: created,
      afterData: this.adminToSafeObject(created),
    });

    return this.adminToSafeObject(created);
  }

  async updateSubAdmin(
    id: number,
    dto: Pick<UpdateAdminDto, 'name' | 'phone'>,
    operator: CurrentUser,
  ) {
    const existing = await this.findOwnedSubAdminOrThrow(id, operator.id);

    const updated = await this.prisma.admin.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
      },
    });

    await this.writeOperationLog({
      action: 'UPDATE_SUB_ADMIN',
      operator,
      target: updated,
      beforeData: this.adminToSafeObject(existing),
      afterData: this.adminToSafeObject(updated),
    });

    return this.adminToSafeObject(updated);
  }

  async updateSubAdminStatus(
    id: number,
    dto: UpdateAdminStatusDto,
    operator: CurrentUser,
  ) {
    const existing = await this.findOwnedSubAdminOrThrow(id, operator.id);

    const updated = await this.prisma.admin.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.writeOperationLog({
      action: 'UPDATE_SUB_ADMIN_STATUS',
      operator,
      target: updated,
      beforeData: this.adminToSafeObject(existing),
      afterData: this.adminToSafeObject(updated),
    });

    return this.adminToSafeObject(updated);
  }

  async resetSubAdminPassword(
    id: number,
    dto: ResetPasswordDto,
    operator: CurrentUser,
  ) {
    const existing = await this.findOwnedSubAdminOrThrow(id, operator.id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.admin.update({
      where: { id },
      data: { passwordHash },
    });

    await this.writeOperationLog({
      action: 'RESET_SUB_ADMIN_PASSWORD',
      operator,
      target: existing,
      afterData: { reset: true },
    });

    return null;
  }

  private buildWhere(
    query: QueryAdminDto,
    roles?: AdminRole[],
  ): Prisma.AdminWhereInput {
    const where: Prisma.AdminWhereInput = {};

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { username: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (roles?.length) {
      where.role = { in: roles };
    }

    return where;
  }

  private async findAdminOrThrow(id: number): Promise<Admin> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    return admin;
  }

  private async countEnabledSuperAdmins(): Promise<number> {
    return this.prisma.admin.count({
      where: {
        role: AdminRole.SUPER,
        status: AdminStatus.ENABLED,
      },
    });
  }

  private async findOwnedSubAdminOrThrow(
    id: number,
    parentAdminId: number,
  ): Promise<Admin> {
    const admin = await this.prisma.admin.findFirst({
      where: {
        id,
        role: AdminRole.SUB_ADMIN,
        parentAdminId,
      },
    });
    if (!admin) {
      throw new NotFoundException('子管理员不存在');
    }
    return admin;
  }

  private adminToSafeObject(admin: Admin) {
    return {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      phone: admin.phone,
      role: admin.role,
      status: admin.status,
      parentAdminId: admin.parentAdminId,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  private buildStatusCountMap(
    groupedCounts: Array<{
      statusId: number;
      _count?: { statusId?: number } | true;
    }>,
  ) {
    return new Map(
      groupedCounts.map((item) => {
        const merchantCount =
          typeof item._count === 'object' && item._count
            ? (item._count.statusId ?? 0)
            : 0;

        return [item.statusId, merchantCount];
      }),
    );
  }

  private buildStatusStats(
    statuses: Array<{
      id: number;
      name: string;
      code: string;
      color: string | null;
      sort: number;
    }>,
    countMap: Map<number, number>,
    totalMerchantCount: number,
  ) {
    return statuses.map((status) => {
      const merchantCount = countMap.get(status.id) ?? 0;
      const ratio =
        totalMerchantCount > 0
          ? Number((merchantCount / totalMerchantCount).toFixed(4))
          : 0;

      return {
        statusId: status.id,
        statusName: status.name,
        statusCode: status.code,
        color: status.color,
        sort: status.sort,
        merchantCount,
        ratio,
      };
    });
  }

  private formatExportTimestamp(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  private async writeOperationLog(params: {
    action: string;
    operator: CurrentUser;
    target: Admin;
    beforeData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    afterData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    const { action, operator, target, beforeData, afterData } = params;
    await this.prisma.operationLog.create({
      data: {
        module: 'ADMIN',
        action,
        targetType: 'ADMIN',
        targetId: target.id,
        targetName: target.username,
        operatorId: operator.id,
        operatorName: operator.name,
        beforeData,
        afterData,
      },
    });
  }
}
