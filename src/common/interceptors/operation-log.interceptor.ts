import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { LOG_META_KEY, LogMeta } from '../decorators/log.decorator';

type AuthUser = {
  id?: number;
  name?: string;
  username?: string;
};

type HttpRequest = {
  body?: unknown;
  params?: Record<string, string>;
  ip?: string;
  user?: AuthUser;
};

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<LogMeta>(LOG_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const operatorId = request.user?.id;
    if (!operatorId) {
      return next.handle();
    }
    const operatorName =
      request.user?.name ?? request.user?.username ?? 'system';
    const targetId = this.resolveTargetId(request, meta);
    const targetName = this.resolveTargetName(request, meta);
    const beforeData =
      meta.options?.recordRequestBody === false
        ? undefined
        : this.safeJson(request.body);

    return next.handle().pipe(
      tap((responseBody) => {
        const afterData =
          meta.options?.recordResponseBody === false
            ? undefined
            : this.safeJson(responseBody);

        void this.prisma.operationLog.create({
          data: {
            module: meta.module,
            action: meta.action,
            targetType: meta.options?.targetType ?? 'UNKNOWN',
            targetId,
            targetName,
            operatorId,
            operatorName,
            beforeData,
            afterData,
            ip: request.ip,
          },
        });
      }),
      catchError((error: unknown) => {
        void this.prisma.operationLog.create({
          data: {
            module: meta.module,
            action: `${meta.action}_FAILED`,
            targetType: meta.options?.targetType ?? 'UNKNOWN',
            targetId,
            targetName,
            operatorId,
            operatorName,
            beforeData,
            afterData: this.safeJson({
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown operation error',
            }),
            ip: request.ip,
          },
        });
        return throwError(() => error);
      }),
    );
  }

  private resolveTargetId(request: HttpRequest, meta: LogMeta): number | null {
    const targetIdParam = meta.options?.targetIdParam ?? 'id';
    const rawId = request.params?.[targetIdParam];
    if (!rawId) {
      return null;
    }
    const parsed = Number(rawId);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private resolveTargetName(
    request: HttpRequest,
    meta: LogMeta,
  ): string | null {
    const field = meta.options?.targetNameField ?? 'name';
    if (
      typeof request.body === 'object' &&
      request.body !== null &&
      field in request.body
    ) {
      const value = (request.body as Record<string, unknown>)[field];
      return typeof value === 'string' ? value : null;
    }
    return null;
  }

  private safeJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }
    try {
      const text = JSON.stringify(value, (key, raw) => {
        const lowered = key.toLowerCase();
        if (
          lowered.includes('password') ||
          lowered.includes('token') ||
          lowered.includes('secret')
        ) {
          return '***';
        }
        if (raw instanceof Date) {
          return raw.toISOString();
        }
        const safeRaw: unknown = raw;
        return safeRaw;
      });
      if (text === undefined) {
        return undefined;
      }
      return JSON.parse(text) as Prisma.InputJsonValue;
    } catch {
      return undefined;
    }
  }
}
