import {
  Body,
  Controller,
  Delete,
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
import { CopyTemplateDto } from './dto/copy-template.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateTemplateFieldDto } from './dto/create-template-field.dto';
import { ToggleTemplateDto } from './dto/toggle-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateService } from './template.service';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER)
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  @ApiOperation({ summary: '模板列表' })
  list() {
    return this.templateService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: '模板详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.detail(id);
  }

  @Post()
  @ApiOperation({ summary: '创建模板' })
  create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.templateService.create(dto, user);
  }

  @Post(':id/copy')
  @ApiOperation({ summary: '复制模板' })
  copy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CopyTemplateDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.templateService.copy(id, dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑模板基础信息' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.templateService.update(id, dto, user);
  }

  @Post(':id/fields')
  @ApiOperation({ summary: '新增模板字段' })
  addField(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTemplateFieldDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.templateService.addField(id, dto, user);
  }

  @Put(':id/status')
  @ApiOperation({ summary: '启用/停用模板' })
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleTemplateDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.templateService.toggle(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除模板' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.templateService.remove(id, user);
  }

  @Delete(':id/fields/:fieldId')
  @ApiOperation({ summary: '删除模板字段' })
  removeField(
    @Param('id', ParseIntPipe) id: number,
    @Param('fieldId', ParseIntPipe) fieldId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.templateService.removeField(id, fieldId, user);
  }
}
