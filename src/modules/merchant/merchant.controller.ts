import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserInfo } from '../auth/interfaces/current-user.interface';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { QueryMerchantDto } from './dto/query-merchant.dto';
import { UpdateMerchantCustomFieldsDto } from './dto/update-merchant-custom-fields.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MerchantService } from './merchant.service';

@ApiTags('Merchants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchants')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get()
  @ApiOperation({ summary: '商家列表（分页、筛选、数据权限）' })
  query(
    @Query() query: QueryMerchantDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.queryMerchants(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '商家详情（含自定义字段、分配信息、状态记录）' })
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.getMerchantDetail(id, user);
  }

  @Post()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '新增商家' })
  create(@Body() dto: CreateMerchantDto, @CurrentUser() user: CurrentUserInfo) {
    return this.merchantService.createMerchant(dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑商家' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMerchantDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.updateMerchant(id, dto, user);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '删除商家（逻辑删除）' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.deleteMerchant(id, user);
  }

  @Get(':id/custom-fields')
  @ApiOperation({ summary: '获取商家的自定义字段值' })
  getCustomFields(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.getCustomFields(id, user);
  }

  @Put(':id/custom-fields')
  @ApiOperation({ summary: '批量更新商家的自定义字段值' })
  updateCustomFields(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMerchantCustomFieldsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.updateCustomFields(id, dto, user);
  }

  @Put(':id/change-status')
  @ApiOperation({ summary: '变更商家状态' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.changeStatus(id, dto, user);
  }

  @Get(':id/status-logs')
  @ApiOperation({ summary: '查看状态变更记录' })
  getStatusLogs(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.getStatusLogs(id, user);
  }
}
