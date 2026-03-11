import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { QueryLogDto } from './dto/query-log.dto';

@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async queryLogs(query: QueryLogDto, user: CurrentUser) {
    const where = this.buildWhere(query, user);
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, list] = await this.prisma.$transaction([
      this.prisma.operationLog.count({ where }),
      this.prisma.operationLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getDetail(id: number, user: CurrentUser) {
    const log = await this.prisma.operationLog.findUnique({ where: { id } });
    if (!log) {
      throw new NotFoundException('日志不存在');
    }
    if (user.role !== AdminRole.SUPER && log.operatorId !== user.id) {
      throw new ForbiddenException('无访问权限');
    }
    return log;
  }

  private buildWhere(
    query: QueryLogDto,
    user: CurrentUser,
  ): Prisma.OperationLogWhereInput {
    const where: Prisma.OperationLogWhereInput = {};

    if (query.module?.trim()) {
      where.module = { contains: query.module.trim(), mode: 'insensitive' };
    }
    if (query.action?.trim()) {
      where.action = { contains: query.action.trim(), mode: 'insensitive' };
    }
    if (user.role !== AdminRole.SUPER) {
      where.operatorId = user.id;
    } else if (query.operatorId) {
      where.operatorId = query.operatorId;
    }
    if (query.targetType?.trim()) {
      where.targetType = {
        contains: query.targetType.trim(),
        mode: 'insensitive',
      };
    }
    if (query.createdAtStart || query.createdAtEnd) {
      where.createdAt = {};
      if (query.createdAtStart) {
        where.createdAt.gte = new Date(query.createdAtStart);
      }
      if (query.createdAtEnd) {
        where.createdAt.lte = new Date(query.createdAtEnd);
      }
    }

    return where;
  }
}
