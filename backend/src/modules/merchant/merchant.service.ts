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
import { BatchDeleteMerchantsDto } from './dto/batch-delete-merchants.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { ImportMerchantsDto } from './dto/import-merchants.dto';
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

type MerchantImportAction =
  | '新增'
  | '补全'
  | '覆盖更新'
  | '无变更'
  | '失败';

type MerchantImportRecordItem = {
  rowNumber: number;
  merchantName?: string;
  action: MerchantImportAction;
  reason?: string;
};

type MerchantImportDebugItem = {
  rowNumber: number;
  merchantName?: string;
  normalizedRowKeys: string[];
  parsedValues: {
    name?: string;
    contactName?: string;
    contactPhone?: string;
    businessType?: string;
    status?: string;
  };
  overwriteExisting: boolean;
  hasExplicitStatus: boolean;
  existingMerchant?: {
    id: number;
    contactName?: string | null;
    contactPhone?: string | null;
    businessType?: string | null;
    statusId: number;
  };
  mergeFields?: string[];
  action?: MerchantImportAction;
  reason?: string;
};

type MerchantImportDebugInfo = {
  sheetName: string;
  headerRowNumber: number;
  rawHeaders: string[];
  normalizedHeaders: string[];
  sheetCandidates: Array<{
    sheetName: string;
    headerRowNumber: number;
    matchedHeaderCount: number;
    rawHeaders: string[];
  }>;
  sampleCells: Array<{
    address: string;
    value?: string;
    formula?: string;
    display?: string;
  }>;
  rows: MerchantImportDebugItem[];
};

type PreparedImportMerchant = {
  dto: CreateMerchantDto;
  hasExplicitStatus: boolean;
  parsedValues: {
    name?: string;
    contactName?: string;
    contactPhone?: string;
    businessType?: string;
    status?: string;
  };
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

  async exportMerchants(query: QueryMerchantDto, user: CurrentUser) {
    const where = this.buildQueryWhere(query, user);
    const merchants = await this.prisma.merchant.findMany({
      where,
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
    });

    const rows: Array<Array<string>> = [
      [
        '经营者名称',
        '统一社会信用代码',
        '法定代表人（负责人）',
        '法定代表人联系方式',
        '经营场所',
        '日常监督管理机构',
        '许可证编号',
        '餐饮类型',
        '状态',
        '分配管理员',
      ],
      ...merchants.map((merchant) => [
        merchant.name,
        merchant.creditCode ?? '',
        merchant.contactName ?? '',
        merchant.contactPhone ?? '',
        merchant.address ?? '',
        merchant.supervisionAgency ?? '',
        merchant.licenseNo ?? '',
        merchant.businessType ?? '',
        merchant.status?.name ?? '',
        this.formatAssignedAdminsForExport(merchant),
      ]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, '商家数据');

    return {
      fileName: `merchants-${user.username}-${this.formatExportTimestamp(new Date())}.xlsx`,
      buffer: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      }) as Buffer,
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
    options: ImportMerchantsDto,
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

    const headerMeta = this.selectImportSheet(workbook);
    const sheet = workbook.Sheets[headerMeta.sheetName];
    if (!sheet) {
      throw new BadRequestException('Excel 中没有可用工作表');
    }
    this.ensureImportHeaders(headerMeta.normalizedHeaders);

    const rows = XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
        range: headerMeta.headerRowIndex,
      })
      .map((row) => this.normalizeImportRow(row));
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
    const records: MerchantImportRecordItem[] = [];
    const debugRows: MerchantImportDebugItem[] = [];
    let successCount = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = headerMeta.headerRowIndex + index + 2;
      const merchantName = this.getImportCell(row, 'name');

      try {
        const payload = await this.buildImportMerchantPayload(
          row,
          statusLookup,
          defaultStatusId,
        );
        const debugRow = options.debug
          ? this.createImportDebugRow(rowNumber, row, payload, options)
          : undefined;
        const result = await this.createOrMergeImportedMerchant(
          payload,
          user,
          options.overwriteExisting ?? false,
          debugRow,
        );
        records.push({
          rowNumber,
          merchantName: merchantName || payload.dto.name,
          action: result.action,
        });
        if (debugRow) {
          debugRow.action = result.action;
          debugRows.push(debugRow);
        }
        successCount += 1;
      } catch (error) {
        const reason = this.getImportErrorMessage(error);
        errors.push({
          rowNumber,
          merchantName: merchantName || undefined,
          reason,
        });
        records.push({
          rowNumber,
          merchantName: merchantName || undefined,
          action: '失败',
          reason,
        });
        if (options.debug) {
          debugRows.push({
            rowNumber,
            merchantName: merchantName || undefined,
            normalizedRowKeys: Object.keys(row),
            parsedValues: {
              name: this.getImportCell(row, 'name'),
              contactName: this.getImportCell(row, 'contactName'),
              contactPhone: this.getImportCell(row, 'contactPhone'),
              businessType: this.getImportCell(row, 'businessType'),
              status: this.getImportCell(row, 'status'),
            },
            overwriteExisting: options.overwriteExisting ?? false,
            hasExplicitStatus: !!this.getImportCell(row, 'status'),
            action: '失败',
            reason,
          });
        }
      }
    }

    return {
      total: rows.length,
      successCount,
      failureCount: errors.length,
      errors,
      records,
      debug: options.debug
        ? {
            sheetName: headerMeta.sheetName,
            headerRowNumber: headerMeta.headerRowIndex + 1,
            rawHeaders: headerMeta.rawHeaders,
            normalizedHeaders: headerMeta.normalizedHeaders,
            sheetCandidates: headerMeta.sheetCandidates,
            sampleCells: this.collectImportSampleCells(sheet),
            rows: debugRows,
          }
        : undefined,
    };
  }

  private async createOrMergeImportedMerchant(
    payload: PreparedImportMerchant,
    user: CurrentUser,
    overwriteExisting: boolean,
    debugRow?: MerchantImportDebugItem,
  ): Promise<{ action: MerchantImportAction }> {
    const { dto } = payload;
    const existingMerchants = await this.prisma.merchant.findMany({
      where: {
        name: dto.name,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    if (existingMerchants.length === 0) {
      await this.createMerchant(dto, user);
      if (debugRow) {
        debugRow.mergeFields = [];
      }
      return { action: '新增' };
    }

    if (existingMerchants.length > 1) {
      throw new BadRequestException(
        '存在多条同名商家，无法自动补全，请先清理重复数据',
      );
    }

    const existing = existingMerchants[0];
    if (debugRow) {
      debugRow.existingMerchant = {
        id: existing.id,
        contactName: existing.contactName,
        contactPhone: existing.contactPhone,
        businessType: existing.businessType,
        statusId: existing.statusId,
      };
    }
    const mergeData = this.buildImportMergeData(
      existing,
      payload,
      overwriteExisting,
    );
    if (debugRow) {
      debugRow.mergeFields = this.extractMergeFieldNames(mergeData);
    }
    if (Object.keys(mergeData).length === 0) {
      return { action: '无变更' };
    }

    const action = this.resolveImportMergeAction(
      existing,
      payload,
      overwriteExisting,
    );

    const updated = await this.prisma.merchant.update({
      where: { id: existing.id },
      data: mergeData,
    });

    if (existing.statusId !== updated.statusId) {
      await this.prisma.merchantStatusLog.create({
        data: {
          merchantId: updated.id,
          fromStatusId: existing.statusId,
          toStatusId: updated.statusId,
          changedBy: user.id,
          remark: 'Excel 导入覆盖状态',
        },
      });
    }

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

    return { action };
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
    await this.softDeleteMerchants([existing], user);
    return null;
  }

  async batchDeleteMerchants(dto: BatchDeleteMerchantsDto, user: CurrentUser) {
    const merchantIds = [...new Set(dto.merchantIds)];
    const merchants = await this.prisma.merchant.findMany({
      where: {
        id: { in: merchantIds },
        deletedAt: null,
      },
    });

    if (merchants.length !== merchantIds.length) {
      const foundIds = new Set(merchants.map((item) => item.id));
      const missingIds = merchantIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `部分商家不存在或已删除：${missingIds.join('、')}`,
      );
    }

    await this.softDeleteMerchants(merchants, user);

    return {
      count: merchants.length,
    };
  }

  async clearAllMerchants(user: CurrentUser) {
    const merchants = await this.prisma.merchant.findMany({
      where: { deletedAt: null },
    });

    if (merchants.length === 0) {
      return { count: 0 };
    }

    await this.softDeleteMerchants(merchants, user);

    return {
      count: merchants.length,
    };
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

  private formatAssignedAdminsForExport(merchant: {
    admins?: Array<{ admin: { name: string } }>;
    subAdmins?: Array<{ subAdmin: { name: string } }>;
  }) {
    const normalAdmins = merchant.admins?.map((item) => item.admin.name) ?? [];
    const subAdmins = merchant.subAdmins?.map((item) => item.subAdmin.name) ?? [];
    const parts: string[] = [];

    if (normalAdmins.length) {
      parts.push(`管理员：${normalAdmins.join('，')}`);
    }
    if (subAdmins.length) {
      parts.push(`子管理员：${subAdmins.join('，')}`);
    }

    return parts.join('；') || '未分配';
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

  private async findMerchantOrThrow(id: number): Promise<Merchant> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!merchant) {
      throw new NotFoundException('商家不存在');
    }
    return merchant;
  }

  private async softDeleteMerchants(merchants: Merchant[], user: CurrentUser) {
    const merchantIds = merchants.map((item) => item.id);
    const deletedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.merchant.updateMany({
        where: {
          id: { in: merchantIds },
          deletedAt: null,
        },
        data: { deletedAt },
      }),
      ...merchants.map((merchant) =>
        this.prisma.operationLog.create({
          data: {
            module: 'MERCHANT',
            action: 'DELETE_MERCHANT',
            targetType: 'MERCHANT',
            targetId: merchant.id,
            targetName: merchant.name,
            operatorId: user.id,
            operatorName: user.name,
            beforeData: this.merchantToPlainObject(merchant),
          },
        }),
      ),
    ]);
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

  private selectImportSheet(workbook: XLSX.WorkBook): {
    sheetName: string;
    headerRowIndex: number;
    rawHeaders: string[];
    normalizedHeaders: string[];
    sheetCandidates: Array<{
      sheetName: string;
      headerRowNumber: number;
      matchedHeaderCount: number;
      rawHeaders: string[];
    }>;
  } {
    const candidates = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return null;
      }

      const headerMeta = this.extractImportHeaders(sheet);
      return {
        sheetName,
        headerRowIndex: headerMeta.headerRowIndex,
        rawHeaders: headerMeta.rawHeaders,
        normalizedHeaders: headerMeta.normalizedHeaders,
        matchedHeaderCount: this.countMatchedImportHeaders(
          headerMeta.normalizedHeaders,
        ),
      };
    }).filter(
      (
        candidate,
      ): candidate is {
        sheetName: string;
        headerRowIndex: number;
        rawHeaders: string[];
        normalizedHeaders: string[];
        matchedHeaderCount: number;
      } => !!candidate,
    );

    const bestCandidate = [...candidates].sort((a, b) => {
      if (b.matchedHeaderCount !== a.matchedHeaderCount) {
        return b.matchedHeaderCount - a.matchedHeaderCount;
      }
      return a.headerRowIndex - b.headerRowIndex;
    })[0];

    if (!bestCandidate) {
      throw new BadRequestException('Excel 文件缺少表头');
    }

    return {
      sheetName: bestCandidate.sheetName,
      headerRowIndex: bestCandidate.headerRowIndex,
      rawHeaders: bestCandidate.rawHeaders,
      normalizedHeaders: bestCandidate.normalizedHeaders,
      sheetCandidates: candidates.map((candidate) => ({
        sheetName: candidate.sheetName,
        headerRowNumber: candidate.headerRowIndex + 1,
        matchedHeaderCount: candidate.matchedHeaderCount,
        rawHeaders: candidate.rawHeaders,
      })),
    };
  }

  private extractImportHeaders(sheet: XLSX.WorkSheet): {
    headerRowIndex: number;
    rawHeaders: string[];
    normalizedHeaders: string[];
  } {
    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    if (!headerRows.length) {
      throw new BadRequestException('Excel 文件缺少表头');
    }

    const headerRowIndex = this.detectImportHeaderRowIndex(headerRows);
    const headerRow = headerRows[headerRowIndex];
    if (!Array.isArray(headerRow)) {
      throw new BadRequestException('Excel 文件缺少表头');
    }

    const rawHeaders = headerRow
      .map((cell) => this.normalizeImportString(cell))
      .filter((header): header is string => !!header);
    const normalizedHeaders = headerRow
      .map((cell) => this.normalizeImportHeaderKey(cell))
      .filter((header): header is string => !!header);

    return {
      headerRowIndex,
      rawHeaders,
      normalizedHeaders,
    };
  }

  private countMatchedImportHeaders(headers: string[]): number {
    const knownHeaders = new Set(
      Object.values(MERCHANT_IMPORT_HEADERS)
        .flat()
        .map((header) => this.normalizeImportHeaderKey(header))
        .filter((header): header is string => !!header),
    );

    return headers.filter((header) => knownHeaders.has(header)).length;
  }

  private collectImportSampleCells(sheet: XLSX.WorkSheet) {
    const addresses = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2', 'A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3'];

    return addresses.map((address) => {
      const cell = sheet[address] as
        | { v?: unknown; w?: string; f?: string }
        | undefined;

      return {
        address,
        value: this.normalizeImportString(cell?.v),
        formula: cell?.f,
        display: this.normalizeImportString(cell?.w),
      };
    });
  }

  private detectImportHeaderRowIndex(rows: unknown[][]): number {
    const knownHeaders = new Set(
      Object.values(MERCHANT_IMPORT_HEADERS)
        .flat()
        .map((header) => this.normalizeImportHeaderKey(header))
        .filter((header): header is string => !!header),
    );
    const requiredHeaders = new Set(
      MERCHANT_IMPORT_HEADERS.name
        .map((header) => this.normalizeImportHeaderKey(header))
        .filter((header): header is string => !!header),
    );

    let bestRowIndex = 0;
    let bestScore = -1;

    rows.slice(0, 10).forEach((row, index) => {
      if (!Array.isArray(row)) {
        return;
      }

      const normalizedCells = row
        .map((cell) => this.normalizeImportHeaderKey(cell))
        .filter((cell): cell is string => !!cell);

      if (normalizedCells.length === 0) {
        return;
      }

      const matchCount = normalizedCells.filter((cell) =>
        knownHeaders.has(cell),
      ).length;
      const hasRequiredHeader = normalizedCells.some((cell) =>
        requiredHeaders.has(cell),
      );
      const score = matchCount * 10 + (hasRequiredHeader ? 100 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestRowIndex = index;
      }
    });

    return bestRowIndex;
  }

  private ensureImportHeaders(headers: string[]) {
    if (
      !MERCHANT_IMPORT_HEADERS.name.some((header) =>
        headers.includes(this.normalizeImportHeaderKey(header) ?? header),
      )
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

  private async buildImportMerchantPayload(
    row: Record<string, unknown>,
    statusLookup: Map<string, number>,
    defaultStatusId: number,
  ): Promise<PreparedImportMerchant> {
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

    return {
      dto,
      hasExplicitStatus: !!statusValue,
      parsedValues: {
        name: payload.name,
        contactName: payload.contactName,
        contactPhone: payload.contactPhone,
        businessType: payload.businessType,
        status: statusValue,
      },
    };
  }

  private getImportCell(
    row: Record<string, unknown>,
    field: keyof typeof MERCHANT_IMPORT_HEADERS,
  ): string | undefined {
    for (const header of MERCHANT_IMPORT_HEADERS[field]) {
      const normalizedHeader = this.normalizeImportHeaderKey(header);
      if (!normalizedHeader) {
        continue;
      }
      const value = this.normalizeImportString(row[normalizedHeader]);
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  private normalizeImportRow(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalizedRow: Record<string, unknown> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const normalizedKey = this.normalizeImportHeaderKey(rawKey);
      if (!normalizedKey || normalizedKey in normalizedRow) {
        continue;
      }
      normalizedRow[normalizedKey] = value;
    }
    return normalizedRow;
  }

  private normalizeImportHeaderKey(value: unknown): string | undefined {
    const normalized = this.normalizeImportString(value);
    if (!normalized) {
      return undefined;
    }

    const compact = normalized
      .normalize('NFKC')
      .replace(/[\s\u200B-\u200D\uFEFF]+/g, '');

    return compact.length > 0 ? compact : undefined;
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
    incoming: PreparedImportMerchant,
    overwriteExisting: boolean,
  ): Prisma.MerchantUpdateInput {
    const { dto, hasExplicitStatus } = incoming;
    const mergeData: Prisma.MerchantUpdateInput = {};

    if (
      this.shouldApplyImportedValue(
        existing.creditCode,
        dto.creditCode,
        overwriteExisting,
      )
    ) {
      mergeData.creditCode = dto.creditCode;
    }
    if (
      this.shouldApplyImportedValue(
        existing.contactName,
        dto.contactName,
        overwriteExisting,
      )
    ) {
      mergeData.contactName = dto.contactName;
    }
    if (
      this.shouldApplyImportedValue(
        existing.contactPhone,
        dto.contactPhone,
        overwriteExisting,
      )
    ) {
      mergeData.contactPhone = dto.contactPhone;
    }
    if (
      this.shouldApplyImportedValue(existing.address, dto.address, overwriteExisting)
    ) {
      mergeData.address = dto.address;
    }
    if (
      this.shouldApplyImportedValue(
        existing.supervisionAgency,
        dto.supervisionAgency,
        overwriteExisting,
      )
    ) {
      mergeData.supervisionAgency = dto.supervisionAgency;
    }
    if (
      this.shouldApplyImportedValue(
        existing.licenseNo,
        dto.licenseNo,
        overwriteExisting,
      )
    ) {
      mergeData.licenseNo = dto.licenseNo;
    }
    if (
      this.shouldApplyImportedValue(
        existing.businessType,
        dto.businessType,
        overwriteExisting,
      )
    ) {
      mergeData.businessType = dto.businessType;
    }
    if (
      this.shouldApplyImportedValue(existing.remark, dto.remark, overwriteExisting)
    ) {
      mergeData.remark = dto.remark;
    }
    if (
      overwriteExisting &&
      hasExplicitStatus &&
      existing.statusId !== dto.statusId
    ) {
      mergeData.status = {
        connect: {
          id: dto.statusId,
        },
      };
    }

    return mergeData;
  }

  private resolveImportMergeAction(
    existing: Merchant,
    incoming: PreparedImportMerchant,
    overwriteExisting: boolean,
  ): Exclude<MerchantImportAction, '新增' | '失败' | '无变更'> {
    const { dto, hasExplicitStatus } = incoming;

    if (!overwriteExisting) {
      return '补全';
    }

    const hasOverwrite =
      this.isNonEmptyOverwrite(existing.creditCode, dto.creditCode) ||
      this.isNonEmptyOverwrite(existing.contactName, dto.contactName) ||
      this.isNonEmptyOverwrite(existing.contactPhone, dto.contactPhone) ||
      this.isNonEmptyOverwrite(existing.address, dto.address) ||
      this.isNonEmptyOverwrite(
        existing.supervisionAgency,
        dto.supervisionAgency,
      ) ||
      this.isNonEmptyOverwrite(existing.licenseNo, dto.licenseNo) ||
      this.isNonEmptyOverwrite(existing.businessType, dto.businessType) ||
      this.isNonEmptyOverwrite(existing.remark, dto.remark) ||
      (hasExplicitStatus && existing.statusId !== dto.statusId);

    return hasOverwrite ? '覆盖更新' : '补全';
  }

  private createImportDebugRow(
    rowNumber: number,
    row: Record<string, unknown>,
    payload: PreparedImportMerchant,
    options: ImportMerchantsDto,
  ): MerchantImportDebugItem {
    return {
      rowNumber,
      merchantName: payload.dto.name,
      normalizedRowKeys: Object.keys(row),
      parsedValues: payload.parsedValues,
      overwriteExisting: options.overwriteExisting ?? false,
      hasExplicitStatus: payload.hasExplicitStatus,
    };
  }

  private extractMergeFieldNames(
    mergeData: Prisma.MerchantUpdateInput,
  ): string[] {
    return Object.keys(mergeData).sort();
  }

  private shouldApplyImportedValue(
    existingValue?: string | null,
    incomingValue?: string,
    overwriteExisting = false,
  ) {
    if (this.isEmptyValue(incomingValue)) {
      return false;
    }

    if (overwriteExisting) {
      return existingValue !== incomingValue;
    }

    return this.isEmptyValue(existingValue);
  }

  private isNonEmptyOverwrite(
    existingValue?: string | null,
    incomingValue?: string,
  ) {
    return (
      !this.isEmptyValue(existingValue) &&
      !this.isEmptyValue(incomingValue) &&
      existingValue !== incomingValue
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
