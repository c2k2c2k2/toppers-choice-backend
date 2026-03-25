import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserType } from '@prisma/client';

@Injectable()
export class AdminUserTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    if (user.userType !== UserType.ADMIN) {
      throw new ForbiddenException({
        code: 'ADMIN_ACCESS_REQUIRED',
        message: 'Admin access is required.',
      });
    }

    return true;
  }
}
