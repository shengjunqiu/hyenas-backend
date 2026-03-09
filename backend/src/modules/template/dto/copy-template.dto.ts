import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CopyTemplateDto {
  @ApiProperty({ description: '新模板名称', example: '企业信息模板-副本' })
  @IsString()
  @IsNotEmpty({ message: '新模板名称不能为空' })
  name: string;

  @ApiProperty({ description: '新模板编码', example: 'company_profile_copy' })
  @IsString()
  @IsNotEmpty({ message: '新模板编码不能为空' })
  code: string;

  @ApiPropertyOptional({ description: '新模板说明' })
  @IsOptional()
  @IsString()
  description?: string;
}
