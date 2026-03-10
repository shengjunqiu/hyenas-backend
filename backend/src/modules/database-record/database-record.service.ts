import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataTemplate,
  DataTemplateField,
  ImportSourceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { DatabaseRecordTemplateValidatorService } from './database-record-template-validator.service';
import { CreateDatabaseRecordDto } from './dto/create-database-record.dto';
import { ImportDatabaseRecordsDto } from './dto/import-database-records.dto';
import { QueryDatabaseImportLogDto } from './dto/query-database-import-log.dto';
import { QueryDatabaseRecordDto } from './dto/query-database-record.dto';
import { UpdateDatabaseRecordDto } from './dto/update-database-record.dto';

type TemplateWithFields = DataTemplate & { fields: DataTemplateField[] };
type UploadedExcelFile = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class DatabaseRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateValidator: DatabaseRecordTemplateValidatorService,
  ) {}

  async query(query: QueryDatabaseRecordDto) {
    if (!query.templateId) {
      throw new BadRequestException('templateId 不能为空');
    }

    const where: Prisma.DatabaseRecordWhereInput = {
      templateId: query.templateId,
      deletedAt: null,
    };

    if (query.primaryKeyValue?.trim()) {
      where.primaryKeyValue = {
        contains: query.primaryKeyValue.trim(),
        mode: 'insensitive',
      };
    }

    if (query.keyword?.trim()) {
      where.OR = [
        {
          primaryKeyValue: {
            contains: query.keyword.trim(),
            mode: 'insensitive',
          },
        },
        {
          sourceName: {
            contains: query.keyword.trim(),
            mode: 'insensitive',
          },
        },
      ];
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

    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, list] = await this.prisma.$transaction([
      this.prisma.databaseRecord.count({ where }),
      this.prisma.databaseRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: { id: true, name: true, code: true },
          },
          creator: {
            select: { id: true, username: true, name: true },
          },
          updater: {
            select: { id: true, username: true, name: true },
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

  async detail(id: number) {
    const record = await this.prisma.databaseRecord.findFirst({
      where: { id, deletedAt: null },
      include: {
        template: {
          include: {
            fields: {
              orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
        creator: {
          select: { id: true, username: true, name: true },
        },
        updater: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('数据库数据不存在');
    }

    return record;
  }

  async create(dto: CreateDatabaseRecordDto, operator: CurrentUser) {
    const template = await this.findTemplateWithFieldsOrThrow(dto.templateId);
    const normalized = this.templateValidator.validateAgainstTemplate(
      template,
      dto.dataJson,
    );
    await this.ensurePrimaryKeyUnique(
      dto.templateId,
      normalized.primaryKeyValue,
    );

    const created = await this.prisma.databaseRecord.create({
      data: {
        templateId: dto.templateId,
        primaryKeyValue: normalized.primaryKeyValue,
        dataJson: normalized.dataJson,
        sourceType: ImportSourceType.MANUAL,
        sourceName: dto.sourceName,
        createdBy: operator.id,
      },
      include: {
        template: true,
      },
    });

    await this.writeOperationLog({
      action: 'CREATE_DATABASE_RECORD',
      operator,
      targetId: created.id,
      targetName: created.primaryKeyValue,
      afterData: this.recordToPlainObject(created),
    });

    return created;
  }

  async update(
    id: number,
    dto: UpdateDatabaseRecordDto,
    operator: CurrentUser,
  ) {
    const existing = await this.prisma.databaseRecord.findFirst({
      where: { id, deletedAt: null },
      include: {
        template: {
          include: {
            fields: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('数据库数据不存在');
    }

    const nextData =
      dto.dataJson ?? (existing.dataJson as Record<string, unknown>);
    const normalized = this.templateValidator.validateAgainstTemplate(
      existing.template,
      nextData,
    );

    await this.ensurePrimaryKeyUnique(
      existing.templateId,
      normalized.primaryKeyValue,
      id,
    );

    const updated = await this.prisma.databaseRecord.update({
      where: { id },
      data: {
        primaryKeyValue: normalized.primaryKeyValue,
        dataJson: normalized.dataJson,
        sourceName: dto.sourceName ?? existing.sourceName,
        updatedBy: operator.id,
      },
    });

    await this.writeOperationLog({
      action: 'UPDATE_DATABASE_RECORD',
      operator,
      targetId: updated.id,
      targetName: updated.primaryKeyValue,
      beforeData: this.recordToPlainObject(existing),
      afterData: this.recordToPlainObject(updated),
    });

    return updated;
  }

  async remove(id: number, operator: CurrentUser) {
    const existing = await this.prisma.databaseRecord.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('数据库数据不存在');
    }

    await this.prisma.databaseRecord.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: operator.id,
      },
    });

    await this.writeOperationLog({
      action: 'DELETE_DATABASE_RECORD',
      operator,
      targetId: existing.id,
      targetName: existing.primaryKeyValue,
      beforeData: this.recordToPlainObject(existing),
    });

    return null;
  }

  async queryImportLogs(query: QueryDatabaseImportLogDto) {
    const where: Prisma.DatabaseImportLogWhereInput = {};

    if (query.templateId) {
      where.templateId = query.templateId;
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

    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, list] = await this.prisma.$transaction([
      this.prisma.databaseImportLog.count({ where }),
      this.prisma.databaseImportLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: { id: true, name: true, code: true },
          },
          operator: {
            select: { id: true, username: true, name: true },
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

  async getImportLogDetail(id: number) {
    const log = await this.prisma.databaseImportLog.findUnique({
      where: { id },
      include: {
        template: {
          select: { id: true, name: true, code: true },
        },
        operator: {
          select: { id: true, username: true, name: true },
        },
      },
    });
    if (!log) {
      throw new NotFoundException('导入日志不存在');
    }
    return log;
  }

  async importByExcel(
    file: UploadedExcelFile,
    dto: ImportDatabaseRecordsDto,
    operator: CurrentUser,
  ) {
    if (!file.buffer?.length) {
      throw new BadRequestException('上传文件为空');
    }

    const template = await this.findTemplateWithFieldsOrThrow(dto.templateId);
    const rows = this.readRowsFromExcel(file.buffer);
    const { headerMap, primaryKeyHeader } = this.buildExcelHeaderMap(
      template,
      rows,
    );

    if (!primaryKeyHeader) {
      const primaryField = template.fields.find((field) => field.isPrimaryKey);
      throw new BadRequestException(
        `Excel 缺少主键列: ${primaryField?.fieldName ?? '未知主键字段'}`,
      );
    }

    let totalCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const failures: Array<{
      row: number;
      primaryKeyValue?: string;
      reason: string;
    }> = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const rowData = this.pickMappedRowData(row, headerMap);
      if (Object.keys(rowData).length === 0) {
        continue;
      }

      totalCount += 1;

      try {
        const normalized = this.templateValidator.validateAgainstTemplate(
          template,
          rowData,
        );

        const existing = await this.prisma.databaseRecord.findFirst({
          where: {
            templateId: dto.templateId,
            primaryKeyValue: normalized.primaryKeyValue,
          },
        });

        if (existing) {
          await this.prisma.databaseRecord.update({
            where: { id: existing.id },
            data: {
              dataJson: normalized.dataJson,
              sourceType: ImportSourceType.EXCEL,
              sourceName: file.originalname,
              updatedBy: operator.id,
              deletedAt: null,
            },
          });
          updatedCount += 1;
          continue;
        }

        await this.prisma.databaseRecord.create({
          data: {
            templateId: dto.templateId,
            primaryKeyValue: normalized.primaryKeyValue,
            dataJson: normalized.dataJson,
            sourceType: ImportSourceType.EXCEL,
            sourceName: file.originalname,
            createdBy: operator.id,
          },
        });
        createdCount += 1;
      } catch (error) {
        failures.push({
          row: rowNumber,
          primaryKeyValue: this.readPrimaryKeyValueFromRow(
            row,
            primaryKeyHeader,
          ),
          reason: error instanceof Error ? error.message : '导入失败',
        });
      }
    }

    const importLog = await this.prisma.databaseImportLog.create({
      data: {
        templateId: dto.templateId,
        fileName: file.originalname,
        totalCount,
        createdCount,
        updatedCount,
        failedCount: failures.length,
        failureDetailsJson:
          failures.length > 0
            ? (failures as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        operatorId: operator.id,
      },
    });

    await this.writeOperationLog({
      action: 'IMPORT_DATABASE_RECORDS_BY_EXCEL',
      operator,
      targetId: importLog.id,
      targetName: file.originalname,
      afterData: {
        templateId: dto.templateId,
        fileName: file.originalname,
        totalCount,
        createdCount,
        updatedCount,
        failedCount: failures.length,
      } as Prisma.InputJsonValue,
    });

    return {
      logId: importLog.id,
      totalCount,
      createdCount,
      updatedCount,
      failedCount: failures.length,
      failures,
    };
  }

  private async findTemplateWithFieldsOrThrow(
    templateId: number,
  ): Promise<TemplateWithFields> {
    const template = await this.prisma.dataTemplate.findFirst({
      where: {
        id: templateId,
        isEnabled: true,
      },
      include: {
        fields: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!template) {
      throw new NotFoundException('模板不存在或未启用');
    }
    return template;
  }

  private async ensurePrimaryKeyUnique(
    templateId: number,
    primaryKeyValue: string,
    excludeId?: number,
  ) {
    const duplicate = await this.prisma.databaseRecord.findFirst({
      where: {
        templateId,
        primaryKeyValue,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (!duplicate) {
      return;
    }

    if (duplicate.deletedAt) {
      throw new BadRequestException(
        '主键值已存在于已删除数据中，请先处理旧数据',
      );
    }

    throw new BadRequestException('主键值已存在');
  }

  private buildExcelHeaderMap(
    template: TemplateWithFields,
    rows: Array<Record<string, unknown>>,
  ) {
    const headers = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row).map((key) => key.trim()))),
    ).filter(Boolean);
    const fieldByHeader = new Map<string, DataTemplateField>();
    const mappedFieldKeys = new Set<string>();
    let primaryKeyHeader: string | null = null;

    for (const header of headers) {
      const field = template.fields.find(
        (item) => item.fieldKey === header || item.fieldName === header,
      );
      if (!field) {
        continue;
      }

      if (mappedFieldKeys.has(field.fieldKey)) {
        throw new BadRequestException(
          `Excel 中存在重复映射字段: ${field.fieldName}`,
        );
      }

      fieldByHeader.set(header, field);
      mappedFieldKeys.add(field.fieldKey);

      if (field.isPrimaryKey) {
        primaryKeyHeader = header;
      }
    }

    return {
      headerMap: fieldByHeader,
      primaryKeyHeader,
    };
  }

  private pickMappedRowData(
    row: Record<string, unknown>,
    headerMap: Map<string, DataTemplateField>,
  ) {
    const data: Record<string, unknown> = {};

    for (const [header, field] of headerMap.entries()) {
      const value = row[header];
      if (value === undefined || value === null || value === '') {
        continue;
      }
      data[field.fieldKey] = value;
    }

    return data;
  }

  private readPrimaryKeyValueFromRow(
    row: Record<string, unknown>,
    primaryKeyHeader: string,
  ) {
    const value = row[primaryKeyHeader];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return String(value);
  }

  private readRowsFromExcel(buffer: Buffer) {
    const xlsx = this.loadXlsx();
    const workbook = xlsx.read(buffer, {
      type: 'buffer',
      cellDates: false,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Excel 文件中没有可用工作表');
    }

    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
  }

  private loadXlsx(): {
    read: (
      data: Buffer,
      opts: { type: 'buffer'; cellDates: boolean },
    ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: {
      sheet_to_json: <T>(
        sheet: unknown,
        opts: { defval: string; raw: boolean },
      ) => T[];
    };
  } {
    try {
      return require('xlsx') as {
        read: (
          data: Buffer,
          opts: { type: 'buffer'; cellDates: boolean },
        ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
        utils: {
          sheet_to_json: <T>(
            sheet: unknown,
            opts: { defval: string; raw: boolean },
          ) => T[];
        };
      };
    } catch {
      throw new BadRequestException(
        'Excel 导入依赖 xlsx 未安装，请先在 backend 目录安装该依赖',
      );
    }
  }

  private recordToPlainObject(
    record:
      | Prisma.DatabaseRecordGetPayload<{ include: { template: true } }>
      | Prisma.DatabaseRecordGetPayload<{
          include: { template: { include: { fields: true } } };
        }>
      | {
          id: number;
          templateId: number;
          primaryKeyValue: string;
          dataJson: Prisma.JsonValue;
          sourceType: ImportSourceType;
          sourceName: string | null;
          createdBy: number;
          updatedBy: number | null;
          createdAt: Date;
          updatedAt: Date;
          deletedAt: Date | null;
        },
  ) {
    return {
      id: record.id,
      templateId: record.templateId,
      primaryKeyValue: record.primaryKeyValue,
      dataJson: record.dataJson,
      sourceType: record.sourceType,
      sourceName: record.sourceName,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }

  private async writeOperationLog(params: {
    action: string;
    operator: CurrentUser;
    targetId: number;
    targetName: string;
    beforeData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    afterData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    const { action, operator, targetId, targetName, beforeData, afterData } =
      params;
    await this.prisma.operationLog.create({
      data: {
        module: 'DATABASE_RECORD',
        action,
        targetType: 'DATABASE_RECORD',
        targetId,
        targetName,
        operatorId: operator.id,
        operatorName: operator.name,
        beforeData,
        afterData,
      },
    });
  }
}
