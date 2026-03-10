import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryProjectDto {
  @ApiPropertyOptional({ description: '关键字，支持项目名称/编码' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '模板 ID' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({ description: '项目状态', enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: '开始日期起始（ISO）' })
  @IsOptional()
  @IsDateString()
  startDateStart?: string;

  @ApiPropertyOptional({ description: '开始日期结束（ISO）' })
  @IsOptional()
  @IsDateString()
  startDateEnd?: string;

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
