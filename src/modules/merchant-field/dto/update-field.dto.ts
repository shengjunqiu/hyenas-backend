import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateFieldDto {
  @ApiPropertyOptional({ description: '字段名称' })
  @IsOptional()
  @IsString()
  fieldName?: string;

  @ApiPropertyOptional({ description: '是否必填' })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: '是否可搜索' })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiPropertyOptional({ description: '默认值' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ description: '选项（SELECT/MULTI_SELECT 可更新）' })
  @IsOptional()
  @IsArray()
  optionsJson?: unknown[];

  @ApiPropertyOptional({ description: '排序' })
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
