import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserInfo } from '../auth/interfaces/current-user.interface';
import { CreateFieldDto } from './dto/create-field.dto';
import { ToggleFieldDto } from './dto/toggle-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { MerchantFieldService } from './merchant-field.service';

@ApiTags('Merchant Fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchant-fields')
export class MerchantFieldController {
  constructor(private readonly merchantFieldService: MerchantFieldService) {}

  @Get()
  @ApiOperation({ summary: '字段定义列表' })
  list() {
    return this.merchantFieldService.list();
  }

  @Post()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '新增字段定义' })
  create(@Body() dto: CreateFieldDto, @CurrentUser() user: CurrentUserInfo) {
    return this.merchantFieldService.create(dto, user);
  }

  @Put(':id')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '编辑字段定义' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFieldDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantFieldService.update(id, dto, user);
  }

  @Put(':id/toggle')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '启用/禁用字段定义' })
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleFieldDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantFieldService.toggle(id, dto, user);
  }
}
