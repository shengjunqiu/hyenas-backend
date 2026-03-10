import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserInfo } from '../auth/interfaces/current-user.interface';
import { CreateDatabaseRecordDto } from './dto/create-database-record.dto';
import { ImportDatabaseRecordsDto } from './dto/import-database-records.dto';
import { QueryDatabaseImportLogDto } from './dto/query-database-import-log.dto';
import { QueryDatabaseRecordDto } from './dto/query-database-record.dto';
import { UpdateDatabaseRecordDto } from './dto/update-database-record.dto';
import { DatabaseRecordService } from './database-record.service';

@ApiTags('Database Records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER)
@Controller('database-records')
export class DatabaseRecordController {
  constructor(private readonly databaseRecordService: DatabaseRecordService) {}

  @Get()
  @ApiOperation({ summary: '数据库数据列表' })
  query(@Query() query: QueryDatabaseRecordDto) {
    return this.databaseRecordService.query(query);
  }

  @Get('import-logs')
  @ApiOperation({ summary: '数据库导入日志列表' })
  queryImportLogs(@Query() query: QueryDatabaseImportLogDto) {
    return this.databaseRecordService.queryImportLogs(query);
  }

  @Get('import-logs/:id')
  @ApiOperation({ summary: '数据库导入日志详情' })
  importLogDetail(@Param('id', ParseIntPipe) id: number) {
    return this.databaseRecordService.getImportLogDetail(id);
  }

  @Get(':id')
  @ApiOperation({ summary: '数据库数据详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.databaseRecordService.detail(id);
  }

  @Post()
  @ApiOperation({ summary: '新增数据库数据' })
  create(
    @Body() dto: CreateDatabaseRecordDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.databaseRecordService.create(dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑数据库数据' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDatabaseRecordDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.databaseRecordService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除数据库数据' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.databaseRecordService.remove(id, user);
  }

  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['templateId', 'file'],
      properties: {
        templateId: {
          type: 'integer',
          description: '模板 ID',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel 文件',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Excel 导入数据库数据' })
  importByExcel(
    @UploadedFile()
    file: { originalname: string; buffer: Buffer } | undefined,
    @Body() dto: ImportDatabaseRecordsDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    if (!file) {
      throw new BadRequestException('请上传 Excel 文件');
    }

    return this.databaseRecordService.importByExcel(file, dto, user);
  }
}
