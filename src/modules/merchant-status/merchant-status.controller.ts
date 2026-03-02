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
import { CreateMerchantStatusDto } from './dto/create-merchant-status.dto';
import { ToggleMerchantStatusDto } from './dto/toggle-merchant-status.dto';
import { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';
import { MerchantStatusService } from './merchant-status.service';

@ApiTags('Merchant Statuses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchant-statuses')
export class MerchantStatusController {
  constructor(private readonly merchantStatusService: MerchantStatusService) {}

  @Get()
  @ApiOperation({ summary: '状态模板列表' })
  list() {
    return this.merchantStatusService.list();
  }

  @Post()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '新增状态模板' })
  create(
    @Body() dto: CreateMerchantStatusDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantStatusService.create(dto, user);
  }

  @Put(':id')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '编辑状态模板' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMerchantStatusDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantStatusService.update(id, dto, user);
  }

  @Put(':id/toggle')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '启用/禁用状态模板' })
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleMerchantStatusDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantStatusService.toggle(id, dto, user);
  }
}
