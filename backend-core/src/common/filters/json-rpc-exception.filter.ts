import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class JsonRpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ? (b.message as string | string[]).toString() : exception.message;
        details = b.error ?? undefined;
      }
      code = mapStatusToCode(status);
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url} -> ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      error: {
        code,
        message,
        details,
        path: request.url,
        timestamp: new Date().toISOString(),
        correlationId: (request as unknown as { id?: string }).id,
      },
    });
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST: return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED: return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN: return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND: return 'NOT_FOUND';
    case HttpStatus.CONFLICT: return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY: return 'VALIDATION_FAILED';
    case HttpStatus.TOO_MANY_REQUESTS: return 'RATE_LIMITED';
    default: return 'INTERNAL_ERROR';
  }
}
