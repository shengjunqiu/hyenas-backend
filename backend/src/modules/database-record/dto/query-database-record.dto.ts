import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryDatabaseRecordDto {
  @ApiPropertyOptional({ description: '模板 ID' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({ description: '关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '主键值' })
  @IsOptional()
  @IsString()
  primaryKeyValue?: string;

  @ApiPropertyOptional({ description: '创建时间起始（ISO）' })
  @IsOptional()
  @IsDateString()
  createdAtStart?: string;

  @ApiPropertyOptional({ description: '创建时间结束（ISO）' })
  @IsOptional()
  @IsDateString()
  createdAtEnd?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
