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

export class QueryMerchantDto {
  @ApiPropertyOptional({ description: '商家名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '联系人' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: '状态 ID' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  statusId?: number;

  @ApiPropertyOptional({ description: '经营类型' })
  @IsOptional()
  @IsString()
  businessType?: string;

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
