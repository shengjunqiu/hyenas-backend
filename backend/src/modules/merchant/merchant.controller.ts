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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserInfo } from '../auth/interfaces/current-user.interface';
import { BatchDeleteMerchantsDto } from './dto/batch-delete-merchants.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { ImportMerchantsDto } from './dto/import-merchants.dto';
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

  @Get('export')
  @ApiOperation({ summary: '导出当前用户可见商家 Excel' })
  async exportMerchants(
    @Query() query: QueryMerchantDto,
    @CurrentUser() user: CurrentUserInfo,
    @Res() res: Response,
  ) {
    const file = await this.merchantService.exportMerchants(query, user);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

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

  @Post('import')
  @Roles(AdminRole.SUPER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Excel 导入商家' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel 文件，支持 .xlsx 和 .xls',
        },
        overwriteExisting: {
          type: 'boolean',
          description: '是否使用 Excel 中的非空字段覆盖同名商家的已有信息',
        },
      },
    },
  })
  importMerchants(
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @Body() dto: ImportMerchantsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.importMerchants(file, dto, user);
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

  @Post('batch-delete')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '批量删除商家（逻辑删除）' })
  batchDelete(
    @Body() dto: BatchDeleteMerchantsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.merchantService.batchDeleteMerchants(dto, user);
  }

  @Delete()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '清空全部商家（逻辑删除）' })
  clear(@CurrentUser() user: CurrentUserInfo) {
    return this.merchantService.clearAllMerchants(user);
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
