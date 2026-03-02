import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MerchantFieldDef, MerchantFieldType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateFieldDto } from './dto/create-field.dto';
import { ToggleFieldDto } from './dto/toggle-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';

@Injectable()
export class MerchantFieldService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.merchantFieldDef.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateFieldDto, operator: CurrentUser) {
    const exists = await this.prisma.merchantFieldDef.findUnique({
      where: { fieldKey: dto.fieldKey },
    });
    if (exists) {
      throw new BadRequestException('fieldKey 已存在');
    }

    this.validateOptionsForType(dto.fieldType, dto.optionsJson);

    const created = await this.prisma.merchantFieldDef.create({
      data: {
        fieldKey: dto.fieldKey,
        fieldName: dto.fieldName,
        fieldType: dto.fieldType,
        isRequired: dto.isRequired ?? false,
        isEnabled: true,
        isSearchable: dto.isSearchable ?? false,
        defaultValue: dto.defaultValue,
        optionsJson:
          dto.fieldType === MerchantFieldType.SELECT ||
          dto.fieldType === MerchantFieldType.MULTI_SELECT
            ? (dto.optionsJson as Prisma.InputJsonValue)
            : undefined,
        sort: dto.sort ?? 0,
        remark: dto.remark,
      },
    });

    await this.writeOperationLog({
      action: 'CREATE_MERCHANT_FIELD',
      operator,
      target: created,
      afterData: this.fieldToPlainObject(created),
    });

    return created;
  }

  async update(id: number, dto: UpdateFieldDto, operator: CurrentUser) {
    const existing = await this.findByIdOrThrow(id);

    if (
      (existing.fieldType === MerchantFieldType.SELECT ||
        existing.fieldType === MerchantFieldType.MULTI_SELECT) &&
      dto.optionsJson !== undefined &&
      dto.optionsJson.length === 0
    ) {
      throw new BadRequestException('选项字段 optionsJson 不能为空数组');
    }

    const updated = await this.prisma.merchantFieldDef.update({
      where: { id },
      data: {
        fieldName: dto.fieldName,
        isRequired: dto.isRequired,
        isSearchable: dto.isSearchable,
        defaultValue: dto.defaultValue,
        optionsJson:
          dto.optionsJson !== undefined
            ? (dto.optionsJson as Prisma.InputJsonValue)
            : undefined,
        sort: dto.sort,
        remark: dto.remark,
      },
    });

    await this.writeOperationLog({
      action: 'UPDATE_MERCHANT_FIELD',
      operator,
      target: updated,
      beforeData: this.fieldToPlainObject(existing),
      afterData: this.fieldToPlainObject(updated),
    });

    return updated;
  }

  async toggle(id: number, dto: ToggleFieldDto, operator: CurrentUser) {
    const existing = await this.findByIdOrThrow(id);
    const updated = await this.prisma.merchantFieldDef.update({
      where: { id },
      data: { isEnabled: dto.isEnabled },
    });

    await this.writeOperationLog({
      action: 'TOGGLE_MERCHANT_FIELD',
      operator,
      target: updated,
      beforeData: this.fieldToPlainObject(existing),
      afterData: this.fieldToPlainObject(updated),
    });

    return updated;
  }

  private async findByIdOrThrow(id: number): Promise<MerchantFieldDef> {
    const field = await this.prisma.merchantFieldDef.findUnique({
      where: { id },
    });
    if (!field) {
      throw new NotFoundException('字段定义不存在');
    }
    return field;
  }

  private validateOptionsForType(
    fieldType: MerchantFieldType,
    optionsJson?: unknown[],
  ) {
    const needOptions =
      fieldType === MerchantFieldType.SELECT ||
      fieldType === MerchantFieldType.MULTI_SELECT;

    if (needOptions && (!optionsJson || optionsJson.length === 0)) {
      throw new BadRequestException(
        'SELECT/MULTI_SELECT 类型必须提供 optionsJson',
      );
    }
  }

  private fieldToPlainObject(field: MerchantFieldDef) {
    return {
      id: field.id,
      fieldKey: field.fieldKey,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      isEnabled: field.isEnabled,
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
    target: MerchantFieldDef;
    beforeData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    afterData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    const { action, operator, target, beforeData, afterData } = params;
    await this.prisma.operationLog.create({
      data: {
        module: 'MERCHANT_FIELD',
        action,
        targetType: 'MERCHANT_FIELD',
        targetId: target.id,
        targetName: target.fieldName,
        operatorId: operator.id,
        operatorName: operator.name,
        beforeData,
        afterData,
      },
    });
  }
}
