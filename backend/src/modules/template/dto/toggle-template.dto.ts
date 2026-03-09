import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ToggleTemplateDto {
  @ApiProperty({ description: '是否启用', example: false })
  @Type(() => Boolean)
  @IsBoolean()
  isEnabled: boolean;
}
