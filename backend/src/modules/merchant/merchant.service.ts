import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  Merchant,
  MerchantFieldDef,
  MerchantFieldType,
  MerchantFieldValue,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { QueryMerchantDto } from './dto/query-merchant.dto';
import { UpdateMerchantCustomFieldsDto } from './dto/update-merchant-custom-fields.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

type FieldValuePayload = {
  valueText: string | null;
  valueJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

@Injectable()
export class MerchantService {
  constructor(private readonly prisma: PrismaService) {}

  async queryMerchants(query: QueryMerchantDto, user: CurrentUser) {
    const where = this.buildQueryWhere(query, user);
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, list] = await this.prisma.$transaction([
      this.prisma.merchant.count({ where }),
      this.prisma.merchant.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          status: true,
          admins: {
            include: {
              admin: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getMerchantDetail(id: number, user: CurrentUser) {
    await this.ensureMerchantAccessible(id, user);

    const merchant = await this.prisma.merchant.findFirst({
      where: { id, deletedAt: null },
      include: {
        status: true,
        creator: {
          select: { id: true, username: true, name: true, role: true },
        },
        admins: {
          include: {
            admin: {
              select: { id: true, username: true, name: true, role: true },
            },
          },
        },
        fieldValues: {
          include: {
            fieldDef: true,
          },
        },
        statusLogs: {
          include: {
            fromStatus: true,
            toStatus: true,
            changer: {
              select: { id: true, username: true, name: true, role: true },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!merchant) {
      throw new NotFoundException('商家不存在');
    }

    return {
      ...merchant,
      customFields: this.toCustomFieldMap(merchant.fieldValues),
    };
  }

  async createMerchant(dto: CreateMerchantDto, user: CurrentUser) {
    const status = await this.prisma.merchantStatus.findFirst({
      where: { id: dto.statusId, isEnabled: true },
    });
    if (!status) {
      throw new BadRequestException('状态模板不存在或未启用');
    }

    const created = await this.prisma.merchant.create({
      data: {
        name: dto.name,
        creditCode: dto.creditCode,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        address: dto.address,
        licenseNo: dto.licenseNo,
        businessType: dto.businessType,
        statusId: dto.statusId,
        remark: dto.remark,
        createdBy: user.id,
      },
    });

    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      await this.validateAndUpsertCustomFields(created.id, dto.customFields);
    }

    await this.prisma.operationLog.create({
      data: {
        module: 'MERCHANT',
        action: 'CREATE_MERCHANT',
        targetType: 'MERCHANT',
        targetId: created.id,
        targetName: created.name,
        operatorId: user.id,
        operatorName: user.name,
        afterData: this.merchantToPlainObject(created),
      },
    });

    return created;
  }

  async updateMerchant(id: number, dto: UpdateMerchantDto, user: CurrentUser) {
    const existing = await this.findMerchantOrThrow(id);
    await this.ensureMerchantAccessible(id, user);

    if (dto.statusId !== undefined) {
      const status = await this.prisma.merchantStatus.findFirst({
        where: { id: dto.statusId, isEnabled: true },
      });
      if (!status) {
        throw new BadRequestException('状态模板不存在或未启用');
      }
    }

    const updated = await this.prisma.merchant.update({
      where: { id },
      data: {
        name: dto.name,
        creditCode: dto.creditCode,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        address: dto.address,
        licenseNo: dto.licenseNo,
        businessType: dto.businessType,
        statusId: dto.statusId,
        remark: dto.remark,
      },
    });

    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      await this.validateAndUpsertCustomFields(id, dto.customFields);
    }

    await this.prisma.operationLog.create({
      data: {
        module: 'MERCHANT',
        action: 'UPDATE_MERCHANT',
        targetType: 'MERCHANT',
        targetId: updated.id,
        targetName: updated.name,
        operatorId: user.id,
        operatorName: user.name,
        beforeData: this.merchantToPlainObject(existing),
        afterData: this.merchantToPlainObject(updated),
      },
    });

    return updated;
  }

  async deleteMerchant(id: number, user: CurrentUser) {
    const existing = await this.findMerchantOrThrow(id);
    const deleted = await this.prisma.merchant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.prisma.operationLog.create({
      data: {
        module: 'MERCHANT',
        action: 'DELETE_MERCHANT',
        targetType: 'MERCHANT',
        targetId: deleted.id,
        targetName: deleted.name,
        operatorId: user.id,
        operatorName: user.name,
        beforeData: this.merchantToPlainObject(existing),
      },
    });
    return null;
  }

  async getCustomFields(id: number, user: CurrentUser) {
    await this.ensureMerchantAccessible(id, user);
    const defs = await this.prisma.merchantFieldDef.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    const values = await this.prisma.merchantFieldValue.findMany({
      where: { merchantId: id },
      include: { fieldDef: true },
    });
    const valueMap = this.toCustomFieldMap(values);
    return defs.map((def) => ({
      id: def.id,
      fieldKey: def.fieldKey,
      fieldName: def.fieldName,
      fieldType: def.fieldType,
      isRequired: def.isRequired,
      isEnabled: def.isEnabled,
      isSearchable: def.isSearchable,
      defaultValue: def.defaultValue,
      optionsJson: def.optionsJson,
      sort: def.sort,
      remark: def.remark,
      value: valueMap[def.fieldKey] ?? null,
    }));
  }

  async updateCustomFields(
    id: number,
    dto: UpdateMerchantCustomFieldsDto,
    user: CurrentUser,
  ) {
    await this.ensureMerchantAccessible(id, user);
    const before = this.toCustomFieldMap(
      await this.prisma.merchantFieldValue.findMany({
        where: { merchantId: id },
        include: { fieldDef: true },
      }),
    );

    await this.validateAndUpsertCustomFields(id, dto.values);

    const after = this.toCustomFieldMap(
      await this.prisma.merchantFieldValue.findMany({
        where: { merchantId: id },
        include: { fieldDef: true },
      }),
    );

    await this.prisma.operationLog.create({
      data: {
        module: 'MERCHANT',
        action: 'UPDATE_CUSTOM_FIELDS',
        targetType: 'MERCHANT',
        targetId: id,
        operatorId: user.id,
        operatorName: user.name,
        beforeData: before as Prisma.InputJsonValue,
        afterData: after as Prisma.InputJsonValue,
      },
    });

    return null;
  }

  async changeStatus(id: number, dto: ChangeStatusDto, user: CurrentUser) {
    const merchant = await this.findMerchantOrThrow(id);
    await this.ensureMerchantAccessible(id, user);

    const newStatus = await this.prisma.merchantStatus.findFirst({
      where: { id: dto.statusId, isEnabled: true },
    });
    if (!newStatus) {
      throw new BadRequestException('新状态不存在或未启用');
    }

    const oldStatusId = merchant.statusId;
    await this.prisma.$transaction([
      this.prisma.merchant.update({
        where: { id },
        data: {
          statusId: dto.statusId,
        },
      }),
      this.prisma.merchantStatusLog.create({
        data: {
          merchantId: id,
          fromStatusId: oldStatusId,
          toStatusId: dto.statusId,
          changedBy: user.id,
          remark: dto.remark,
        },
      }),
      this.prisma.operationLog.create({
        data: {
          module: 'MERCHANT',
          action: 'CHANGE_STATUS',
          targetType: 'MERCHANT',
          targetId: id,
          targetName: merchant.name,
          operatorId: user.id,
          operatorName: user.name,
          beforeData: { statusId: oldStatusId } as Prisma.InputJsonValue,
          afterData: { statusId: dto.statusId, remark: dto.remark ?? null },
        },
      }),
    ]);

    return null;
  }

  async getStatusLogs(id: number, user: CurrentUser) {
    await this.ensureMerchantAccessible(id, user);
    return this.prisma.merchantStatusLog.findMany({
      where: { merchantId: id },
      include: {
        fromStatus: true,
        toStatus: true,
        changer: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildQueryWhere(
    query: QueryMerchantDto,
    user: CurrentUser,
  ): Prisma.MerchantWhereInput {
    const where: Prisma.MerchantWhereInput = {
      deletedAt: null,
    };

    if (query.name?.trim()) {
      where.name = { contains: query.name.trim(), mode: 'insensitive' };
    }
    if (query.contactName?.trim()) {
      where.contactName = {
        contains: query.contactName.trim(),
        mode: 'insensitive',
      };
    }
    if (query.contactPhone?.trim()) {
      where.contactPhone = { contains: query.contactPhone.trim() };
    }
    if (query.statusId) {
      where.statusId = query.statusId;
    }
    if (query.businessType?.trim()) {
      where.businessType = {
        contains: query.businessType.trim(),
        mode: 'insensitive',
      };
    }

    if (query.createdAtStart || query.createdAtEnd) {
      where.createdAt = {};
      if (query.createdAtStart) {
        where.createdAt.gte = new Date(query.createdAtStart);
      }
      if (query.createdAtEnd) {
        where.createdAt.lte = new Date(query.createdAtEnd);
      }
    }

    if (user.role === AdminRole.SUPER) {
      if (query.adminId) {
        where.admins = {
          some: { adminId: query.adminId },
        };
      }
    } else {
      where.admins = {
        some: {
          adminId: user.id,
        },
      };
    }

    return where;
  }

  private async findMerchantOrThrow(id: number): Promise<Merchant> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!merchant) {
      throw new NotFoundException('商家不存在');
    }
    return merchant;
  }

  private async ensureMerchantAccessible(id: number, user: CurrentUser) {
    if (user.role === AdminRole.SUPER) {
      return;
    }
    const relation = await this.prisma.merchantAdmin.findFirst({
      where: { merchantId: id, adminId: user.id },
    });
    if (!relation) {
      throw new ForbiddenException('无访问权限');
    }
  }

  private async validateAndUpsertCustomFields(
    merchantId: number,
    values: Record<string, unknown>,
  ) {
    const keys = Object.keys(values);
    if (keys.length === 0) {
      return;
    }

    const defs = await this.prisma.merchantFieldDef.findMany({
      where: {
        fieldKey: { in: keys },
        isEnabled: true,
      },
    });
    const defsMap = new Map(defs.map((d) => [d.fieldKey, d]));

    for (const key of keys) {
      if (!defsMap.has(key)) {
        throw new BadRequestException(`字段 ${key} 不存在或未启用`);
      }
    }

    const enabledDefs = await this.prisma.merchantFieldDef.findMany({
      where: { isEnabled: true },
    });
    const existing = await this.prisma.merchantFieldValue.findMany({
      where: { merchantId },
      include: { fieldDef: true },
    });
    const existingMap = this.toCustomFieldMap(existing);

    for (const def of enabledDefs) {
      if (!def.isRequired) {
        continue;
      }
      const incoming = values[def.fieldKey];
      const finalValue =
        incoming !== undefined ? incoming : existingMap[def.fieldKey];
      if (this.isEmptyValue(finalValue)) {
        throw new BadRequestException(`字段 ${def.fieldName} 为必填项`);
      }
    }

    for (const [fieldKey, rawValue] of Object.entries(values)) {
      const def = defsMap.get(fieldKey);
      if (!def) {
        continue;
      }
      const payload = this.normalizeFieldValue(def, rawValue);
      await this.prisma.merchantFieldValue.upsert({
        where: {
          merchantId_fieldDefId: {
            merchantId,
            fieldDefId: def.id,
          },
        },
        update: payload,
        create: {
          merchantId,
          fieldDefId: def.id,
          ...payload,
        },
      });
    }
  }

  private normalizeFieldValue(
    def: MerchantFieldDef,
    rawValue: unknown,
  ): FieldValuePayload {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      if (def.isRequired) {
        throw new BadRequestException(`字段 ${def.fieldName} 为必填项`);
      }
      return { valueText: null, valueJson: Prisma.DbNull };
    }

    if (
      def.fieldType === MerchantFieldType.TEXT ||
      def.fieldType === MerchantFieldType.TEXTAREA
    ) {
      if (typeof rawValue !== 'string') {
        throw new BadRequestException(`字段 ${def.fieldName} 必须是字符串`);
      }
      return {
        valueText: rawValue,
        valueJson: Prisma.DbNull,
      };
    }

    if (def.fieldType === MerchantFieldType.NUMBER) {
      if (typeof rawValue !== 'number' && Number.isNaN(Number(rawValue))) {
        throw new BadRequestException(`字段 ${def.fieldName} 必须是数字`);
      }
      return {
        valueText: String(Number(rawValue)),
        valueJson: Prisma.DbNull,
      };
    }

    if (def.fieldType === MerchantFieldType.DATE) {
      if (
        typeof rawValue !== 'string' &&
        typeof rawValue !== 'number' &&
        !(rawValue instanceof Date)
      ) {
        throw new BadRequestException(`字段 ${def.fieldName} 必须是有效日期`);
      }
      const date = new Date(rawValue);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`字段 ${def.fieldName} 必须是有效日期`);
      }
      return {
        valueText: date.toISOString(),
        valueJson: Prisma.DbNull,
      };
    }

    if (def.fieldType === MerchantFieldType.BOOLEAN) {
      if (typeof rawValue !== 'boolean') {
        throw new BadRequestException(`字段 ${def.fieldName} 必须是布尔值`);
      }
      return {
        valueText: rawValue ? 'true' : 'false',
        valueJson: Prisma.DbNull,
      };
    }

    if (def.fieldType === MerchantFieldType.SELECT) {
      if (typeof rawValue !== 'string') {
        throw new BadRequestException(`字段 ${def.fieldName} 必须是字符串`);
      }
      const options = this.resolveOptions(def);
      if (!options.includes(rawValue)) {
        throw new BadRequestException(`字段 ${def.fieldName} 取值不在选项范围`);
      }
      return {
        valueText: rawValue,
        valueJson: Prisma.DbNull,
      };
    }

    if (def.fieldType === MerchantFieldType.MULTI_SELECT) {
      if (!Array.isArray(rawValue)) {
        throw new BadRequestException(`字段 ${def.fieldName} 必须是数组`);
      }
      const options = this.resolveOptions(def);
      const normalized = rawValue.map((item) => {
        if (
          typeof item !== 'string' &&
          typeof item !== 'number' &&
          typeof item !== 'boolean'
        ) {
          throw new BadRequestException(`字段 ${def.fieldName} 存在无效选项值`);
        }
        return String(item);
      });
      for (const item of normalized) {
        if (!options.includes(item)) {
          throw new BadRequestException(
            `字段 ${def.fieldName} 取值不在选项范围`,
          );
        }
      }
      return {
        valueText: null,
        valueJson: normalized as Prisma.InputJsonValue,
      };
    }

    throw new BadRequestException(`字段 ${def.fieldName} 类型不支持`);
  }

  private resolveOptions(def: MerchantFieldDef): string[] {
    if (!Array.isArray(def.optionsJson)) {
      return [];
    }
    return def.optionsJson
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (
          typeof item === 'object' &&
          item !== null &&
          'value' in item &&
          typeof (item as { value: unknown }).value === 'string'
        ) {
          return (item as { value: string }).value;
        }
        return null;
      })
      .filter((item): item is string => !!item);
  }

  private toCustomFieldMap(
    values: Array<MerchantFieldValue & { fieldDef: MerchantFieldDef }>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const item of values) {
      if (
        item.fieldDef.fieldType === MerchantFieldType.MULTI_SELECT &&
        Array.isArray(item.valueJson)
      ) {
        result[item.fieldDef.fieldKey] = item.valueJson;
        continue;
      }
      if (item.fieldDef.fieldType === MerchantFieldType.NUMBER) {
        result[item.fieldDef.fieldKey] = item.valueText
          ? Number(item.valueText)
          : null;
        continue;
      }
      if (item.fieldDef.fieldType === MerchantFieldType.BOOLEAN) {
        result[item.fieldDef.fieldKey] = item.valueText === 'true';
        continue;
      }
      result[item.fieldDef.fieldKey] = item.valueText ?? item.valueJson ?? null;
    }
    return result;
  }

  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return false;
  }

  private merchantToPlainObject(merchant: Merchant) {
    return {
      id: merchant.id,
      name: merchant.name,
      creditCode: merchant.creditCode,
      contactName: merchant.contactName,
      contactPhone: merchant.contactPhone,
      address: merchant.address,
      licenseNo: merchant.licenseNo,
      businessType: merchant.businessType,
      statusId: merchant.statusId,
      remark: merchant.remark,
      createdBy: merchant.createdBy,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
      deletedAt: merchant.deletedAt,
    };
  }
}
