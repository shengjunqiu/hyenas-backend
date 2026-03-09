import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FieldType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateTemplateFieldDto {
  @ApiProperty({ description: '字段编码', example: 'companyName' })
  @IsString()
  fieldKey: string;

  @ApiProperty({ description: '字段名称', example: '企业名称' })
  @IsString()
  fieldName: string;

  @ApiProperty({ enum: FieldType, description: '字段类型' })
  @IsEnum(FieldType)
  fieldType: FieldType;

  @ApiPropertyOptional({ description: '是否必填', default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: '是否主键', default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isPrimaryKey?: boolean;

  @ApiPropertyOptional({ description: '是否列表展示', default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isListed?: boolean;

  @ApiPropertyOptional({ description: '是否可搜索', default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiPropertyOptional({ description: '默认值' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ description: '选项配置', type: [String] })
  @IsOptional()
  @IsArray()
  optionsJson?: string[];

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
