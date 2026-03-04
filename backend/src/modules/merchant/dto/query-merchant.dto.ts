import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SUPERVISION_AGENCIES } from '../constants/supervision-agencies';

export class QueryMerchantDto {
  @ApiPropertyOptional({ description: '经营者名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '法定代表人（负责人）' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: '法定代表人联系方式' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: '状态 ID' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  statusId?: number;

  @ApiPropertyOptional({ description: '餐饮类型' })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({
    description: '日常监督管理机构',
    enum: SUPERVISION_AGENCIES,
  })
  @IsOptional()
  @IsString()
  @IsIn([...SUPERVISION_AGENCIES], {
    message: `日常监督管理机构必须是以下值之一：${SUPERVISION_AGENCIES.join('、')}`,
  })
  supervisionAgency?: string;

  @ApiPropertyOptional({ description: '管理员 ID（SUPER 可用）' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  adminId?: number;

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
