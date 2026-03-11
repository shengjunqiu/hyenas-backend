import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';
import {
  AdminRole,
  Merchant,
  MerchantFieldDef,
  MerchantFieldType,
  MerchantFieldValue,
  MerchantStatus,
  Prisma,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { SUPERVISION_AGENCIES } from './constants/supervision-agencies';
import { MerchantAccessService } from './merchant-access.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { QueryMerchantDto } from './dto/query-merchant.dto';
import { UpdateMerchantCustomFieldsDto } from './dto/update-merchant-custom-fields.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

type FieldValuePayload = {
  valueText: string | null;
  valueJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

type UploadedExcelFile = {
  buffer: Buffer;
  originalname: string;
};

type MerchantImportErrorItem = {
  rowNumber: number;
  merchantName?: string;
  reason: string;
};

const MERCHANT_IMPORT_HEADERS = {
  name: ['经营者名称'],
  creditCode: ['统一社会信用代码'],
  contactName: ['法定代表人（负责人）', '法定代表人', '负责人'],
  contactPhone: ['法定代表人联系方式', '负责人联系方式', '联系电话'],
  address: ['经营场所', '地址'],
  supervisionAgency: ['日常监督管理机构'],
  licenseNo: ['许可证编号'],
  businessType: ['餐饮类型', '经营类型'],
  status: ['状态', '商家状态'],
  remark: ['备注'],
} as const;

const SUPERVISION_AGENCY_IMPORT_MAP = [
  ['宝盖', '宝盖镇市场监督管理所'],
  ['凤里', '凤里街道市场监督管理所'],
  ['蚶江', '蚶江镇市场监督管理所'],
  ['鸿山', '鸿山镇市场监督管理所'],
  ['湖滨', '湖滨街道市场监督管理所'],
  ['锦尚', '锦尚镇市场监督管理所'],
  ['灵秀', '灵秀镇市场监督管理所'],
  ['祥芝', '祥芝镇市场监督管理所'],
  ['永宁', '永宁镇市场监督管理所'],
] as const;

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccessService: MerchantAccessService,
  ) {}

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
          subAdmins: {
            include: {
              subAdmin: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  role: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      list: list.map((item) => ({
        ...item,
        accessLevel: user.role === AdminRole.SUB_ADMIN ? 'STATUS_ONLY' : 'FULL',
      })),
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getMerchantDetail(id: number, user: CurrentUser) {
    const accessLevel = await this.merchantAccessService.ensureReadableAccess(
      id,
      user,
    );

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
        subAdmins: {
          include: {
            subAdmin: {
              select: {
                id: true,
                username: true,
                name: true,
                role: true,
                status: true,
              },
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
      accessLevel,
    };
  }

  async importMerchants(
    file: UploadedExcelFile | undefined,
    user: CurrentUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传 Excel 文件');
    }
    if (!/\.(xlsx|xls)$/i.test(file.originalname)) {
      throw new BadRequestException('仅支持 .xlsx 或 .xls 格式文件');
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('Excel 文件解析失败，请检查文件内容');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('Excel 中没有可用工作表');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const headers = this.extractImportHeaders(sheet);
    this.ensureImportHeaders(headers);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
    if (!rows.length) {
      throw new BadRequestException('Excel 中没有可导入的数据');
    }

    const statuses = await this.prisma.merchantStatus.findMany({
      where: { isEnabled: true },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    const defaultStatusId = this.resolveDefaultImportStatusId(statuses);
    if (!defaultStatusId) {
      throw new BadRequestException('没有可用的启用状态，无法导入商家');
    }
    const statusLookup = this.buildImportStatusLookup(statuses);
    const errors: MerchantImportErrorItem[] = [];
    let successCount = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const merchantName = this.getImportCell(row, 'name');

      try {
        const dto = await this.buildImportMerchantDto(
          row,
          statusLookup,
          defaultStatusId,
        );
        await this.createOrMergeImportedMerchant(dto, user);
        successCount += 1;
      } catch (error) {
        errors.push({
          rowNumber,
          merchantName: merchantName || undefined,
          reason: this.getImportErrorMessage(error),
        });
      }
    }

    return {
      total: rows.length,
      successCount,
      failureCount: errors.length,
      errors,
    };
  }

  private async createOrMergeImportedMerchant(
    dto: CreateMerchantDto,
    user: CurrentUser,
  ) {
    const existingMerchants = await this.prisma.merchant.findMany({
      where: {
        name: dto.name,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    if (existingMerchants.length === 0) {
      return this.createMerchant(dto, user);
    }

    if (existingMerchants.length > 1) {
      throw new BadRequestException(
        '存在多条同名商家，无法自动补全，请先清理重复数据',
      );
    }

    const existing = existingMerchants[0];
    const mergeData = this.buildImportMergeData(existing, dto);
    if (Object.keys(mergeData).length === 0) {
      return existing;
    }

    const updated = await this.prisma.merchant.update({
      where: { id: existing.id },
      data: mergeData,
    });

    await this.prisma.operationLog.create({
      data: {
        module: 'MERCHANT',
        action: 'IMPORT_MERCHANT_MERGE',
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
        supervisionAgency: dto.supervisionAgency,
        licenseNo: dto.licenseNo,
        businessType: dto.businessType,
        statusId: dto.statusId,
        remark: dto.remark,
        createdBy: user.id,
      },
    });

    await this.prisma.merchantStatusLog.create({
      data: {
        merchantId: created.id,
        fromStatusId: null,
        toStatusId: created.statusId,
        changedBy: user.id,
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
    await this.merchantAccessService.ensureFullAccess(id, user);
    const nextStatusId = dto.statusId ?? existing.statusId;

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
        supervisionAgency: dto.supervisionAgency,
        licenseNo: dto.licenseNo,
        businessType: dto.businessType,
        statusId: dto.statusId,
        remark: dto.remark,
      },
    });

    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      await this.validateAndUpsertCustomFields(id, dto.customFields);
    }

    if (nextStatusId !== existing.statusId) {
      await this.prisma.merchantStatusLog.create({
        data: {
          merchantId: id,
          fromStatusId: existing.statusId,
          toStatusId: nextStatusId,
          changedBy: user.id,
        },
      });
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
    await this.merchantAccessService.ensureReadableAccess(id, user);
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
    await this.merchantAccessService.ensureFullAccess(id, user);
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
    await this.merchantAccessService.ensureStatusAccess(id, user);

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
    await this.merchantAccessService.ensureStatusAccess(id, user);
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
      ...this.merchantAccessService.buildAccessibleWhere(user),
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
    if (query.supervisionAgency?.trim()) {
      where.supervisionAgency = query.supervisionAgency.trim();
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

  private extractImportHeaders(sheet: XLSX.WorkSheet): string[] {
    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    if (!headerRows.length || !Array.isArray(headerRows[0])) {
      throw new BadRequestException('Excel 文件缺少表头');
    }
    return headerRows[0]
      .map((cell) => this.normalizeImportString(cell))
      .filter((header): header is string => !!header);
  }

  private ensureImportHeaders(headers: string[]) {
    if (
      !MERCHANT_IMPORT_HEADERS.name.some((header) => headers.includes(header))
    ) {
      throw new BadRequestException('Excel 缺少“经营者名称”列');
    }
  }

  private buildImportStatusLookup(statuses: MerchantStatus[]) {
    const lookup = new Map<string, number>();
    for (const status of statuses) {
      lookup.set(String(status.id), status.id);
      lookup.set(status.code.trim().toLowerCase(), status.id);
      lookup.set(status.name.trim().toLowerCase(), status.id);
    }
    return lookup;
  }

  private resolveDefaultImportStatusId(
    statuses: MerchantStatus[],
  ): number | undefined {
    return (
      statuses.find((status) => status.code === 'PENDING_REVIEW')?.id ??
      statuses[0]?.id
    );
  }

  private async buildImportMerchantDto(
    row: Record<string, unknown>,
    statusLookup: Map<string, number>,
    defaultStatusId: number,
  ): Promise<CreateMerchantDto> {
    const statusValue = this.getImportCell(row, 'status');
    const statusId = statusValue
      ? this.resolveImportStatusId(statusValue, statusLookup)
      : defaultStatusId;
    if (!statusId) {
      throw new BadRequestException(
        '状态不存在或未启用，请填写状态名称、编码或 ID',
      );
    }

    const payload: Partial<CreateMerchantDto> = {
      name: this.getImportCell(row, 'name') ?? '',
      creditCode: this.getImportCell(row, 'creditCode') ?? undefined,
      contactName: this.getImportCell(row, 'contactName') ?? undefined,
      contactPhone: this.getImportCell(row, 'contactPhone') ?? undefined,
      address: this.getImportCell(row, 'address') ?? undefined,
      supervisionAgency: this.normalizeImportSupervisionAgency(
        this.getImportCell(row, 'supervisionAgency'),
      ),
      licenseNo: this.getImportCell(row, 'licenseNo') ?? undefined,
      businessType: this.getImportCell(row, 'businessType') ?? undefined,
      statusId,
      remark: this.getImportCell(row, 'remark') ?? undefined,
    };

    const dto = plainToInstance(CreateMerchantDto, payload);
    const validationErrors = await validate(dto);
    if (validationErrors.length > 0) {
      throw new BadRequestException(
        this.getValidationErrorMessage(validationErrors),
      );
    }

    return dto;
  }

  private getImportCell(
    row: Record<string, unknown>,
    field: keyof typeof MERCHANT_IMPORT_HEADERS,
  ): string | undefined {
    for (const header of MERCHANT_IMPORT_HEADERS[field]) {
      const value = this.normalizeImportString(row[header]);
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  private normalizeImportString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'object') {
      return undefined;
    }

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      typeof value !== 'bigint'
    ) {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private resolveImportStatusId(
    statusValue: string,
    statusLookup: Map<string, number>,
  ): number | undefined {
    return statusLookup.get(statusValue.trim().toLowerCase());
  }

  private buildImportMergeData(
    existing: Merchant,
    incoming: CreateMerchantDto,
  ): Prisma.MerchantUpdateInput {
    const mergeData: Prisma.MerchantUpdateInput = {};

    if (
      this.shouldFillExistingValue(existing.creditCode, incoming.creditCode)
    ) {
      mergeData.creditCode = incoming.creditCode;
    }
    if (
      this.shouldFillExistingValue(existing.contactName, incoming.contactName)
    ) {
      mergeData.contactName = incoming.contactName;
    }
    if (
      this.shouldFillExistingValue(existing.contactPhone, incoming.contactPhone)
    ) {
      mergeData.contactPhone = incoming.contactPhone;
    }
    if (this.shouldFillExistingValue(existing.address, incoming.address)) {
      mergeData.address = incoming.address;
    }
    if (
      this.shouldFillExistingValue(
        existing.supervisionAgency,
        incoming.supervisionAgency,
      )
    ) {
      mergeData.supervisionAgency = incoming.supervisionAgency;
    }
    if (this.shouldFillExistingValue(existing.licenseNo, incoming.licenseNo)) {
      mergeData.licenseNo = incoming.licenseNo;
    }
    if (
      this.shouldFillExistingValue(existing.businessType, incoming.businessType)
    ) {
      mergeData.businessType = incoming.businessType;
    }
    if (this.shouldFillExistingValue(existing.remark, incoming.remark)) {
      mergeData.remark = incoming.remark;
    }

    return mergeData;
  }

  private shouldFillExistingValue(
    existingValue?: string | null,
    incomingValue?: string,
  ) {
    return (
      this.isEmptyValue(existingValue) && !this.isEmptyValue(incomingValue)
    );
  }

  private normalizeImportSupervisionAgency(
    supervisionAgency?: string,
  ): string | undefined {
    if (!supervisionAgency) {
      return undefined;
    }

    const exactMatch = SUPERVISION_AGENCIES.find(
      (item) => item === supervisionAgency,
    );
    if (exactMatch) {
      return exactMatch;
    }

    const normalized = supervisionAgency.replace(/\s+/g, '');
    const fuzzyMatch = SUPERVISION_AGENCY_IMPORT_MAP.find(([keyword]) =>
      normalized.includes(keyword),
    );
    return fuzzyMatch?.[1] ?? supervisionAgency;
  }

  private getValidationErrorMessage(errors: ValidationError[]): string {
    const queue = [...errors];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const firstConstraint = current.constraints
        ? Object.values(current.constraints)[0]
        : undefined;
      if (firstConstraint) {
        return firstConstraint;
      }
      if (current.children?.length) {
        queue.push(...current.children);
      }
    }
    return '导入数据校验失败';
  }

  private getImportErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;
        if (Array.isArray(message)) {
          return message.join('；');
        }
        if (typeof message === 'string') {
          return message;
        }
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return '导入失败';
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
      supervisionAgency: merchant.supervisionAgency,
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
