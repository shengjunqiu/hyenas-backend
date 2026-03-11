import {
  Body,
  Controller,
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
import { AdminService } from './admin.service';
import { CreateSubAdminDto } from './dto/create-sub-admin.dto';
import { QueryAdminDto } from './dto/query-admin.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateAdminStatusDto } from './dto/update-admin-status.dto';
import { UpdateSubAdminDto } from './dto/update-sub-admin.dto';

@ApiTags('Sub Admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.NORMAL)
@Controller('sub-admins')
export class SubAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: '子管理员列表（分页、搜索）' })
  query(@Query() query: QueryAdminDto, @CurrentUser() user: CurrentUserInfo) {
    return this.adminService.querySubAdmins(query, user);
  }

  @Post()
  @ApiOperation({ summary: '新增子管理员' })
  create(@Body() dto: CreateSubAdminDto, @CurrentUser() user: CurrentUserInfo) {
    return this.adminService.createSubAdmin(dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑子管理员' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubAdminDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.adminService.updateSubAdmin(id, dto, user);
  }

  @Put(':id/status')
  @ApiOperation({ summary: '启用/禁用子管理员' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminStatusDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.adminService.updateSubAdminStatus(id, dto, user);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: '重置子管理员密码' })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.adminService.resetSubAdminPassword(id, dto, user);
  }
}
