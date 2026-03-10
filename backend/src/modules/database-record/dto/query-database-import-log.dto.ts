import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class QueryDatabaseImportLogDto {
  @ApiPropertyOptional({ description: '模板 ID' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  templateId?: number;

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

  @ApiPropertyOptional({ description: '创建时间起始（ISO）' })
  @IsOptional()
  @IsDateString()
  createdAtStart?: string;

  @ApiPropertyOptional({ description: '创建时间结束（ISO）' })
  @IsOptional()
  @IsDateString()
  createdAtEnd?: string;
}
