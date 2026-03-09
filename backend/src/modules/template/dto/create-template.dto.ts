import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateTemplateFieldDto } from './create-template-field.dto';

export class CreateTemplateDto {
  @ApiProperty({ description: '模板名称', example: '企业信息模板' })
  @IsString()
  @IsNotEmpty({ message: '模板名称不能为空' })
  name: string;

  @ApiProperty({ description: '模板编码', example: 'company_profile' })
  @IsString()
  @IsNotEmpty({ message: '模板编码不能为空' })
  code: string;

  @ApiPropertyOptional({ description: '模板说明' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '字段列表', type: [CreateTemplateFieldDto] })
  @IsArray()
  @ArrayMinSize(1, { message: '至少需要一个字段' })
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateFieldDto)
  fields: CreateTemplateFieldDto[];
}
