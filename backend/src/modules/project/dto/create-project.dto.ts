import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ description: '项目名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '项目编码' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: '模板 ID' })
  @Type(() => Number)
  @IsInt()
  templateId: number;

  @ApiPropertyOptional({ description: '项目描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '项目状态',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: '开始日期（ISO）' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期（ISO）' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
