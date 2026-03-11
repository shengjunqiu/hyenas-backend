import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Admin, AdminRole, AdminStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
