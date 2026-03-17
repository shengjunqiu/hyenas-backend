import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { QueryLogDto } from './dto/query-log.dto';
import { OperationLogService } from './operation-log.service';

@ApiTags('Operation Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('operation-logs')
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get()
  @ApiOperation({ summary: '操作日志列表（分页、筛选）' })
  query(@Query() query: QueryLogDto, @CurrentUser() user: CurrentUserInfo) {
    return this.operationLogService.queryLogs(query, user);
  }

  @Delete()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: '清空全部操作日志' })
  clear(@CurrentUser() user: CurrentUserInfo) {
    return this.operationLogService.clearLogs(user);
  }

  @Get(':id')
  @ApiOperation({ summary: '操作日志详情' })
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.operationLogService.getDetail(id, user);
  }
}
