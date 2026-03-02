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
import { CreateAdminDto } from './dto/create-admin.dto';
import { QueryAdminDto } from './dto/query-admin.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateAdminStatusDto } from './dto/update-admin-status.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiTags('Admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER)
@Controller('admins')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: '管理员列表（分页、搜索）' })
  query(@Query() query: QueryAdminDto) {
    return this.adminService.queryAdmins(query);
  }

  @Post()
  @ApiOperation({ summary: '新增管理员' })
  create(@Body() dto: CreateAdminDto, @CurrentUser() user: CurrentUserInfo) {
    return this.adminService.createAdmin(dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑管理员' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.adminService.updateAdmin(id, dto, user);
  }

  @Put(':id/status')
  @ApiOperation({ summary: '启用/禁用管理员' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminStatusDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.adminService.updateAdminStatus(id, dto, user);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: '重置管理员密码' })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.adminService.resetPassword(id, dto, user);
  }
}
