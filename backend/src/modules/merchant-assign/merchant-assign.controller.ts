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
import { MerchantAssignService } from './merchant-assign.service';

@ApiTags('Merchant Assign')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER)
@Controller()
export class MerchantAssignController {
  constructor(private readonly merchantAssignService: MerchantAssignService) {}

  @Get('merchants/:id/admins')
  @ApiOperation({ summary: '查看商家已分配管理员' })
  getMerchantAdmins(@Param('id', ParseIntPipe) merchantId: number) {
    return this.merchantAssignService.getMerchantAdmins(merchantId);
  }

  @Post('merchants/:id/assign-admins')
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
  @ApiOperation({ summary: '解除某个管理员分配' })
  unassignAdmin(
    @Param('id', ParseIntPipe) merchantId: number,
    @Param('adminId', ParseIntPipe) adminId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantAssignService.unassignAdmin(merchantId, adminId, user);
  }

  @Get('admins/:id/merchants')
  @ApiOperation({ summary: '查看某管理员负责的商家列表' })
  getAdminMerchants(@Param('id', ParseIntPipe) adminId: number) {
    return this.merchantAssignService.getAdminMerchants(adminId);
  }
}
