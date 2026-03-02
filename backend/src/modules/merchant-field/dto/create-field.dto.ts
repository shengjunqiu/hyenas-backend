import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MerchantFieldType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateFieldDto {
  @ApiProperty({ description: '字段 key（唯一）', example: 'risk_level' })
  @IsString()
  @IsNotEmpty({ message: 'fieldKey 不能为空' })
  fieldKey: string;

  @ApiProperty({ description: '字段名称', example: '风险等级' })
  @IsString()
  @IsNotEmpty({ message: 'fieldName 不能为空' })
  fieldName: string;

  @ApiProperty({ enum: MerchantFieldType, description: '字段类型' })
  @IsEnum(MerchantFieldType)
  fieldType: MerchantFieldType;

  @ApiPropertyOptional({ description: '是否必填', default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: '是否可搜索', default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiPropertyOptional({ description: '默认值' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({
    description: '选项（SELECT/MULTI_SELECT 必填）',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  optionsJson?: unknown[];

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
