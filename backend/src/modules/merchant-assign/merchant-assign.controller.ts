import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserInfo } from '../auth/interfaces/current-user.interface';
import { AssignAdminsDto } from './dto/assign-admins.dto';
import { BatchAssignAdminsDto } from './dto/batch-assign-admins.dto';
import { MerchantAssignService } from './merchant-assign.service';

@ApiTags('Merchant Assign')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MerchantAssignController {
  constructor(private readonly merchantAssignService: MerchantAssignService) {}

  @Post('merchants/batch-assign-admins')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '批量给多个商家分配管理员（可多个）' })
  batchAssignAdmins(
    @Body() dto: BatchAssignAdminsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.batchAssignAdmins(
      dto.merchantIds,
      dto.adminIds,
      user,
    );
  }

  @Get('merchants/:id/admins')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '查看商家已分配管理员' })
  getMerchantAdmins(@Param('id', ParseIntPipe) merchantId: number) {
    return this.merchantAssignService.getMerchantAdmins(merchantId);
  }

  @Post('merchants/:id/assign-admins')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '给商家分配管理员（可多个）' })
  assignAdmins(
    @Param('id', ParseIntPipe) merchantId: number,
    @Body() dto: AssignAdminsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.assignAdmins(
      merchantId,
      dto.adminIds,
      user,
    );
  }

  @Delete('merchants/:id/admins/:adminId')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '解除某个管理员分配' })
  unassignAdmin(
    @Param('id', ParseIntPipe) merchantId: number,
    @Param('adminId', ParseIntPipe) adminId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.unassignAdmin(merchantId, adminId, user);
  }

  @Get('admins/:id/merchants')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '查看某管理员负责的商家列表' })
  getAdminMerchants(@Param('id', ParseIntPipe) adminId: number) {
    return this.merchantAssignService.getAdminMerchants(adminId);
  }

  @Get('merchants/:id/sub-admins')
  @Roles(AdminRole.NORMAL)
  @ApiOperation({ summary: '查看商家已分配子管理员' })
  getMerchantSubAdmins(
    @Param('id', ParseIntPipe) merchantId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.getMerchantSubAdmins(merchantId, user);
  }

  @Post('merchants/:id/assign-sub-admins')
  @Roles(AdminRole.NORMAL)
  @ApiOperation({ summary: '给商家分配子管理员（可多个）' })
  assignSubAdmins(
    @Param('id', ParseIntPipe) merchantId: number,
    @Body() dto: AssignAdminsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.assignSubAdmins(
      merchantId,
      dto.adminIds,
      user,
    );
  }

  @Post('merchants/batch-assign-sub-admins')
  @Roles(AdminRole.NORMAL)
  @ApiOperation({ summary: '批量给多个商家分配子管理员（可多个）' })
  batchAssignSubAdmins(
    @Body() dto: BatchAssignAdminsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.batchAssignSubAdmins(
      dto.merchantIds,
      dto.adminIds,
      user,
    );
  }

  @Delete('merchants/:id/sub-admins/:subAdminId')
  @Roles(AdminRole.NORMAL)
  @ApiOperation({ summary: '解除某个子管理员分配' })
  unassignSubAdmin(
    @Param('id', ParseIntPipe) merchantId: number,
    @Param('subAdminId', ParseIntPipe) subAdminId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.unassignSubAdmin(
      merchantId,
      subAdminId,
      user,
    );
  }

  @Get('sub-admins/:id/merchants')
  @Roles(AdminRole.NORMAL)
  @ApiOperation({ summary: '查看某子管理员负责的商家列表' })
  getSubAdminMerchants(
    @Param('id', ParseIntPipe) subAdminId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.getSubAdminMerchants(subAdminId, user);
  }
}
