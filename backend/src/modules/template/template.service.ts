import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataTemplate,
  DataTemplateField,
  FieldType,
  Prisma,
  TemplateStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CopyTemplateDto } from './dto/copy-template.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateTemplateFieldDto } from './dto/create-template-field.dto';
import { ToggleTemplateDto } from './dto/toggle-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const templates = await this.prisma.dataTemplate.findMany({
      include: {
        _count: {
          select: {
            fields: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return templates.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      description: item.description,
      status: item.status,
      isEnabled: item.isEnabled,
      copiedFromId: item.copiedFromId,
      fieldCount: item._count.fields,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async detail(id: number) {
    const template = await this.prisma.dataTemplate.findUnique({
      where: { id },
      include: {
        copiedFrom: {
          select: { id: true, name: true, code: true },
        },
        creator: {
          select: { id: true, username: true, name: true },
        },
        fields: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return template;
  }

  async create(dto: CreateTemplateDto, operator: CurrentUser) {
    await this.ensureTemplateCodeUnique(dto.code);
    this.validateFields(dto.fields);

    const created = await this.prisma.dataTemplate.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        status: TemplateStatus.DRAFT,
        isEnabled: true,
        createdBy: operator.id,
        fields: {
          create: dto.fields.map((field) => this.toFieldCreateInput(field)),
        },
      },
      include: {
        fields: true,
      },
    });

    await this.writeOperationLog({
      action: 'CREATE_TEMPLATE',
      operator,
      target: created,
      afterData: this.templateToPlainObject(created),
    });

    return created;
  }

  async copy(id: number, dto: CopyTemplateDto, operator: CurrentUser) {
    const existing = await this.prisma.dataTemplate.findUnique({
      where: { id },
      include: {
        fields: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('模板不存在');
    }

    await this.ensureTemplateCodeUnique(dto.code);

    const created = await this.prisma.dataTemplate.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description ?? existing.description,
        status: TemplateStatus.DRAFT,
        isEnabled: true,
        copiedFromId: existing.id,
        createdBy: operator.id,
        fields: {
          create: existing.fields.map((field) => ({
            fieldKey: field.fieldKey,
            fieldName: field.fieldName,
            fieldType: field.fieldType,
            isRequired: field.isRequired,
            isPrimaryKey: field.isPrimaryKey,
            isListed: field.isListed,
            isSearchable: field.isSearchable,
            defaultValue: field.defaultValue,
            optionsJson: field.optionsJson
              ? (field.optionsJson as Prisma.InputJsonValue)
              : undefined,
            sort: field.sort,
            remark: field.remark,
          })),
        },
      },
      include: {
        fields: true,
      },
    });

    await this.writeOperationLog({
      action: 'COPY_TEMPLATE',
      operator,
      target: created,
      afterData: {
        ...this.templateToPlainObject(created),
        copiedFromId: existing.id,
      },
    });

    return created;
  }

  async update(id: number, dto: UpdateTemplateDto, operator: CurrentUser) {
    const existing = await this.findTemplateOrThrow(id);
    if (dto.code && dto.code !== existing.code) {
      await this.ensureTemplateCodeUnique(dto.code);
    }

    const updated = await this.prisma.dataTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
      },
    });

    await this.writeOperationLog({
      action: 'UPDATE_TEMPLATE',
      operator,
      target: updated,
      beforeData: this.templateToPlainObject(existing),
      afterData: this.templateToPlainObject(updated),
    });

    return updated;
  }

  async addField(
    id: number,
    dto: CreateTemplateFieldDto,
    operator: CurrentUser,
  ) {
    const template = await this.prisma.dataTemplate.findUnique({
      where: { id },
      include: {
        fields: true,
      },
    });
    if (!template) {
      throw new NotFoundException('模板不存在');
    }
    if (template.status !== TemplateStatus.DRAFT) {
      throw new BadRequestException('仅草稿模板允许新增字段');
    }

    this.validateFields([
      ...template.fields.map((field) => ({
        fieldKey: field.fieldKey,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        isPrimaryKey: field.isPrimaryKey,
        isListed: field.isListed,
        isSearchable: field.isSearchable,
        defaultValue: field.defaultValue ?? undefined,
        optionsJson: Array.isArray(field.optionsJson)
          ? (field.optionsJson as string[])
          : undefined,
        sort: field.sort,
        remark: field.remark ?? undefined,
      })),
      dto,
    ]);

    const created = await this.prisma.dataTemplateField.create({
      data: {
        templateId: id,
        ...this.toFieldCreateInput(dto),
      },
    });

    await this.prisma.operationLog.create({
      data: {
        module: 'TEMPLATE',
        action: 'CREATE_TEMPLATE_FIELD',
        targetType: 'DATA_TEMPLATE_FIELD',
        targetId: created.id,
        targetName: created.fieldName,
        operatorId: operator.id,
        operatorName: operator.name,
        afterData: this.fieldToPlainObject(created),
      },
    });

    return created;
  }

  async toggle(id: number, dto: ToggleTemplateDto, operator: CurrentUser) {
    const existing = await this.findTemplateOrThrow(id);
    const updated = await this.prisma.dataTemplate.update({
      where: { id },
      data: {
        isEnabled: dto.isEnabled,
      },
    });

    await this.writeOperationLog({
      action: 'TOGGLE_TEMPLATE',
      operator,
      target: updated,
      beforeData: this.templateToPlainObject(existing),
      afterData: this.templateToPlainObject(updated),
    });

    return updated;
  }

  async remove(id: number, operator: CurrentUser) {
    const existing = await this.prisma.dataTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            databaseRecords: true,
            projects: true,
            projectRecords: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('模板不存在');
    }

    if (existing._count.projects > 0 || existing._count.projectRecords > 0) {
      throw new BadRequestException('模板已被项目使用，不可删除');
    }
    if (existing._count.databaseRecords > 0) {
      throw new BadRequestException('模板已有数据库数据，不可删除');
    }

    await this.prisma.dataTemplate.delete({
      where: { id },
    });

    await this.writeOperationLog({
      action: 'DELETE_TEMPLATE',
      operator,
      target: existing,
      beforeData: this.templateToPlainObject(existing),
    });

    return null;
  }

  async removeField(
    templateId: number,
    fieldId: number,
    operator: CurrentUser,
  ) {
    const field = await this.prisma.dataTemplateField.findFirst({
      where: { id: fieldId, templateId },
    });
    if (!field) {
      throw new NotFoundException('模板字段不存在');
    }
    const template = await this.findTemplateOrThrow(templateId);
    if (template.status !== TemplateStatus.DRAFT) {
      throw new BadRequestException('仅草稿模板允许删除字段');
    }
    if (field.isPrimaryKey) {
      throw new BadRequestException('主键字段不可删除');
    }

    const [databaseRecords, projectRecords] = await this.prisma.$transaction([
      this.prisma.databaseRecord.findMany({
        where: { templateId, deletedAt: null },
        select: { id: true, dataJson: true },
      }),
      this.prisma.projectRecord.findMany({
        where: { templateId, deletedAt: null },
        select: { id: true, dataJson: true },
      }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      for (const record of databaseRecords) {
        await tx.databaseRecord.update({
          where: { id: record.id },
          data: {
            dataJson: this.removeFieldFromJson(record.dataJson, field.fieldKey),
          },
        });
      }

      for (const record of projectRecords) {
        await tx.projectRecord.update({
          where: { id: record.id },
          data: {
            dataJson: this.removeFieldFromJson(record.dataJson, field.fieldKey),
          },
        });
      }

      await tx.dataTemplateField.delete({
        where: { id: field.id },
      });

      await tx.operationLog.create({
        data: {
          module: 'TEMPLATE',
          action: 'DELETE_TEMPLATE_FIELD',
          targetType: 'DATA_TEMPLATE_FIELD',
          targetId: field.id,
          targetName: field.fieldName,
          operatorId: operator.id,
          operatorName: operator.name,
          beforeData: this.fieldToPlainObject(field),
          afterData: {
            templateId,
            cleanedDatabaseRecordCount: databaseRecords.length,
            cleanedProjectRecordCount: projectRecords.length,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return null;
  }

  private validateFields(fields: CreateTemplateFieldDto[]) {
    const fieldKeySet = new Set<string>();
    let primaryKeyCount = 0;

    for (const field of fields) {
      if (fieldKeySet.has(field.fieldKey)) {
        throw new BadRequestException(`字段编码重复: ${field.fieldKey}`);
      }
      fieldKeySet.add(field.fieldKey);

      if (field.isPrimaryKey) {
        primaryKeyCount += 1;
      }

      if (
        (field.fieldType === FieldType.SELECT ||
          field.fieldType === FieldType.MULTI_SELECT) &&
        (!field.optionsJson || field.optionsJson.length === 0)
      ) {
        throw new BadRequestException(`字段 ${field.fieldName} 必须配置选项`);
      }
    }

    if (primaryKeyCount !== 1) {
      throw new BadRequestException('模板必须且只能配置一个主键字段');
    }
  }

  private toFieldCreateInput(field: CreateTemplateFieldDto): Prisma.DataTemplateFieldCreateWithoutTemplateInput {
    return {
      fieldKey: field.fieldKey,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      isRequired: field.isRequired ?? false,
      isPrimaryKey: field.isPrimaryKey ?? false,
      isListed: field.isListed ?? false,
      isSearchable: field.isSearchable ?? false,
      defaultValue: field.defaultValue,
      optionsJson: field.optionsJson ? (field.optionsJson as Prisma.InputJsonValue) : undefined,
      sort: field.sort ?? 0,
      remark: field.remark,
    };
  }

  private async ensureTemplateCodeUnique(code: string) {
    const existing = await this.prisma.dataTemplate.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException('模板编码已存在');
    }
  }

  private async findTemplateOrThrow(id: number): Promise<DataTemplate> {
    const template = await this.prisma.dataTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('模板不存在');
    }
    return template;
  }

  private removeFieldFromJson(value: Prisma.JsonValue, fieldKey: string): Prisma.InputJsonValue {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {} as Prisma.InputJsonValue;
    }

    const cloned = { ...(value as Record<string, unknown>) };
    delete cloned[fieldKey];
    return cloned as Prisma.InputJsonValue;
  }

  private templateToPlainObject(template: DataTemplate) {
    return {
      id: template.id,
      name: template.name,
      code: template.code,
      description: template.description,
      status: template.status,
      isEnabled: template.isEnabled,
      copiedFromId: template.copiedFromId,
      createdBy: template.createdBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  private fieldToPlainObject(field: DataTemplateField) {
    return {
      id: field.id,
      templateId: field.templateId,
      fieldKey: field.fieldKey,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      isPrimaryKey: field.isPrimaryKey,
      isListed: field.isListed,
      isSearchable: field.isSearchable,
      defaultValue: field.defaultValue,
      optionsJson: field.optionsJson,
      sort: field.sort,
      remark: field.remark,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    };
  }

  private async writeOperationLog(params: {
    action: string;
    operator: CurrentUser;
    target: DataTemplate;
    beforeData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    afterData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    const { action, operator, target, beforeData, afterData } = params;
    await this.prisma.operationLog.create({
      data: {
        module: 'TEMPLATE',
        action,
        targetType: 'DATA_TEMPLATE',
        targetId: target.id,
        targetName: target.name,
        operatorId: operator.id,
        operatorName: operator.name,
        beforeData,
        afterData,
      },
    });
  }
}
