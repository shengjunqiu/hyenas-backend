import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DataTemplate,
  DataTemplateField,
  FieldType,
  Prisma,
} from '@prisma/client';

type TemplateWithFields = DataTemplate & { fields: DataTemplateField[] };

@Injectable()
export class DatabaseRecordTemplateValidatorService {
  validateAgainstTemplate(
    template: TemplateWithFields,
    input: Record<string, unknown>,
  ): { dataJson: Prisma.InputJsonValue; primaryKeyValue: string } {
    this.ensureNoUnknownFields(template, input);

    const output: Record<string, unknown> = {};

    for (const field of template.fields) {
      const value =
        input[field.fieldKey] === undefined ||
        input[field.fieldKey] === null ||
        input[field.fieldKey] === ''
          ? (field.defaultValue ?? input[field.fieldKey])
          : input[field.fieldKey];
      const normalized = this.normalizeFieldValue(field, value);
      if (normalized !== undefined) {
        output[field.fieldKey] = normalized;
      }
    }

    return {
      dataJson: output as Prisma.InputJsonValue,
      primaryKeyValue: this.extractPrimaryKeyValue(template, output),
    };
  }

  extractPrimaryKeyValue(
    template: TemplateWithFields,
    dataJson: Record<string, unknown>,
  ): string {
    const primaryField = template.fields.find((field) => field.isPrimaryKey);
    if (!primaryField) {
      throw new BadRequestException('模板主键字段缺失');
    }

    const value = dataJson[primaryField.fieldKey];
    if (value === undefined || value === null || value === '') {
      throw new BadRequestException(
        `主键字段 ${primaryField.fieldName} 不能为空`,
      );
    }

    return String(value);
  }

  normalizeFieldValue(field: DataTemplateField, rawValue: unknown) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (field.isRequired) {
        throw new BadRequestException(`字段 ${field.fieldName} 为必填项`);
      }
      return undefined;
    }

    if (
      field.fieldType === FieldType.TEXT ||
      field.fieldType === FieldType.TEXTAREA
    ) {
      return String(rawValue).trim();
    }

    if (field.fieldType === FieldType.NUMBER) {
      const value = Number(rawValue);
      if (Number.isNaN(value)) {
        throw new BadRequestException(`字段 ${field.fieldName} 必须为数字`);
      }
      return value;
    }

    if (field.fieldType === FieldType.DATE) {
      const date = new Date(String(rawValue));
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`字段 ${field.fieldName} 日期格式不正确`);
      }
      return date.toISOString();
    }

    if (field.fieldType === FieldType.BOOLEAN) {
      if (
        rawValue === true ||
        rawValue === false ||
        rawValue === 'true' ||
        rawValue === 'false' ||
        rawValue === '1' ||
        rawValue === '0' ||
        rawValue === 1 ||
        rawValue === 0
      ) {
        return (
          rawValue === true ||
          rawValue === 'true' ||
          rawValue === '1' ||
          rawValue === 1
        );
      }
      throw new BadRequestException(`字段 ${field.fieldName} 必须为布尔值`);
    }

    if (field.fieldType === FieldType.SELECT) {
      const value = String(rawValue).trim();
      const options = this.readOptions(field);
      if (!options.includes(value)) {
        throw new BadRequestException(
          `字段 ${field.fieldName} 的值不在可选范围内`,
        );
      }
      return value;
    }

    if (field.fieldType === FieldType.MULTI_SELECT) {
      const values = Array.isArray(rawValue)
        ? rawValue.map((item) => String(item).trim()).filter(Boolean)
        : String(rawValue)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
      const options = this.readOptions(field);
      if (values.some((item) => !options.includes(item))) {
        throw new BadRequestException(`字段 ${field.fieldName} 存在无效选项`);
      }
      return values;
    }

    return rawValue;
  }

  private ensureNoUnknownFields(
    template: TemplateWithFields,
    input: Record<string, unknown>,
  ) {
    const fieldKeys = new Set(template.fields.map((field) => field.fieldKey));
    const unknownKeys = Object.keys(input).filter((key) => {
      if (fieldKeys.has(key)) {
        return false;
      }

      const value = input[key];
      return value !== undefined && value !== null && value !== '';
    });

    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `存在未定义字段: ${unknownKeys.join(', ')}`,
      );
    }
  }

  private readOptions(field: DataTemplateField) {
    if (!Array.isArray(field.optionsJson)) {
      return [];
    }

    return field.optionsJson.map((item) => String(item));
  }
}
