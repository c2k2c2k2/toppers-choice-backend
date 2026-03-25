import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_CONTEXT_HEADER } from './request-context.constants';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(request: Request, response: Response, next: NextFunction) {
    const incomingRequestId = request.header(REQUEST_CONTEXT_HEADER);
    const requestId = incomingRequestId?.trim().length
      ? incomingRequestId
      : randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_CONTEXT_HEADER, requestId);

    this.requestContextService.run({ requestId }, next);
  }
}
