import { SetMetadata } from '@nestjs/common';

export const LOG_META_KEY = 'operation_log_meta';

export interface LogMetaOptions {
  targetType?: string;
  targetIdParam?: string;
  targetNameField?: string;
  recordRequestBody?: boolean;
  recordResponseBody?: boolean;
}

export interface LogMeta {
  module: string;
  action: string;
  options?: LogMetaOptions;
}

export const Log = (module: string, action: string, options?: LogMetaOptions) =>
  SetMetadata(LOG_META_KEY, { module, action, options } satisfies LogMeta);
