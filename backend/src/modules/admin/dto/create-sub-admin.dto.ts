import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateSubAdminDto {
  @ApiProperty({ description: '登录用户名', example: 'subadmin01' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @ApiProperty({ description: '登录密码', minLength: 6, example: '123456' })
  @IsString()
  @MinLength(6, { message: '密码长度不能小于 6 位' })
  password: string;

  @ApiProperty({ description: '姓名', example: '子管理员' })
  @IsString()
  @IsNotEmpty({ message: '姓名不能为空' })
  name: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;
}
