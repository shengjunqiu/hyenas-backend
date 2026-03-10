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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserInfo } from '../auth/interfaces/current-user.interface';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { AssignProjectAdminDto } from './dto/assign-project-admin.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ImportProjectRecordsDto } from './dto/import-project-records.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { QueryProjectRecordDto } from './dto/query-project-record.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateProjectRecordDto } from './dto/update-project-record.dto';
import { ProjectService } from './project.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: '项目列表' })
  query(@Query() query: QueryProjectDto, @CurrentUser() user: CurrentUserInfo) {
    return this.projectService.query(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '项目详情' })
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.detail(id, user);
  }

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: CurrentUserInfo) {
    return this.projectService.create(dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑项目' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.remove(id, user);
  }

  @Post(':id/assign-admin')
  @ApiOperation({ summary: '分配项目管理员' })
  assignAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignProjectAdminDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.assignAdmin(id, dto, user);
  }

  @Get(':id/members')
  @ApiOperation({ summary: '项目成员列表' })
  getMembers(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.getMembers(id, user);
  }

  @Post(':id/members')
  @ApiOperation({ summary: '新增项目成员' })
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.addMember(id, dto, user);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: '移除项目成员' })
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.removeMember(id, memberId, user);
  }

  @Get(':id/records')
  @ApiOperation({ summary: '项目数据列表' })
  queryRecords(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryProjectRecordDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.queryRecords(id, query, user);
  }

  @Get(':id/records/:recordId')
  @ApiOperation({ summary: '项目数据详情' })
  detailRecord(
    @Param('id', ParseIntPipe) id: number,
    @Param('recordId', ParseIntPipe) recordId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.detailRecord(id, recordId, user);
  }

  @Put(':id/records/:recordId')
  @ApiOperation({ summary: '编辑项目数据' })
  updateRecord(
    @Param('id', ParseIntPipe) id: number,
    @Param('recordId', ParseIntPipe) recordId: number,
    @Body() dto: UpdateProjectRecordDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.updateRecord(id, recordId, dto, user);
  }

  @Delete(':id/records/:recordId')
  @ApiOperation({ summary: '删除项目数据' })
  removeRecord(
    @Param('id', ParseIntPipe) id: number,
    @Param('recordId', ParseIntPipe) recordId: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.removeRecord(id, recordId, user);
  }

  @Post(':id/import-records')
  @ApiOperation({ summary: '从数据库导入项目数据' })
  importRecords(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ImportProjectRecordsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.projectService.importRecords(id, dto, user);
  }
}
