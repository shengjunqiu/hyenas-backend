import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryLogDto } from './dto/query-log.dto';
import { OperationLogService } from './operation-log.service';

@ApiTags('Operation Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER)
@Controller('operation-logs')
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get()
  @ApiOperation({ summary: '操作日志列表（分页、筛选）' })
  query(@Query() query: QueryLogDto) {
    return this.operationLogService.queryLogs(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '操作日志详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.operationLogService.getDetail(id);
  }
}
