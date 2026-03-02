import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleFieldDto {
  @ApiProperty({ description: '是否启用', example: false })
  @IsBoolean()
  isEnabled: boolean;
}
