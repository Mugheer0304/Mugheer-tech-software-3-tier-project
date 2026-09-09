import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    (request as unknown as { id?: string }).id = (request.headers['x-correlation-id'] as string) ?? randomUUID();
    response.setHeader('x-correlation-id', (request as unknown as { id: string }).id);

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, start),
        error: (err) => this.log(request, response, start, err),
      }),
    );
  }

  private log(request: Request, response: Response, start: number, err?: unknown) {
    const durationMs = Date.now() - start;
    const payload = {
      method: request.method,
      url: request.url,
      status: err ? 500 : response.statusCode,
      durationMs,
      correlationId: (request as unknown as { id?: string }).id,
      userAgent: request.headers['user-agent'],
    };
    if (err) {
      this.logger.error(JSON.stringify({ ...payload, error: String(err) }));
    } else {
      this.logger.log(JSON.stringify(payload));
    }
  }
}
