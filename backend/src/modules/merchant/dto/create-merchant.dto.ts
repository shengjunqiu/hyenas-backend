import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { SUPERVISION_AGENCIES } from '../constants/supervision-agencies';

export class CreateMerchantDto {
  @ApiProperty({ description: '经营者名称' })
  @IsString()
  @IsNotEmpty({ message: '经营者名称不能为空' })
  name: string;

  @ApiPropertyOptional({ description: '统一社会信用代码' })
  @IsOptional()
  @IsString()
  creditCode?: string;

  @ApiPropertyOptional({ description: '法定代表人（负责人）' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: '法定代表人联系方式' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: '经营场所' })
  @IsOptional()
  @IsString()
  address?: string;

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

  @ApiPropertyOptional({ description: '许可证编号' })
  @IsOptional()
  @IsString()
  licenseNo?: string;

  @ApiPropertyOptional({ description: '餐饮类型' })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiProperty({ description: '状态 ID' })
  @Type(() => Number)
  @IsInt()
  statusId: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '自定义字段值（key: fieldKey）' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
