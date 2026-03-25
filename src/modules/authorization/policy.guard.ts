import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';
import type { Request } from 'express';
import { AUTH_PUBLIC_ROUTE_KEY } from '../auth/auth.constants';
import { POLICY_METADATA_KEY } from './authorization.constants';
import { AuthorizationService } from './authorization.service';
import { PolicyRequirement } from './authorization.types';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(
      AUTH_PUBLIC_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublicRoute) {
      return true;
    }

    const policy = this.reflector.getAllAndOverride<PolicyRequirement>(
      POLICY_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!policy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    if (policy.allowSelfUserIdParam) {
      const routeUserId = request.params?.[policy.allowSelfUserIdParam];
      if (routeUserId && routeUserId === user.userId) {
        return true;
      }
    }

    if ((policy.adminOnly ?? false) && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException({
        code: 'ADMIN_ACCESS_REQUIRED',
        message: 'Admin access is required.',
      });
    }

    const evaluation = await this.authorizationService.evaluatePolicy(
      user.siteId,
      user.userId,
      policy,
    );

    request.authorizationAccess = evaluation.accessSummary;

    if (!evaluation.allowed) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to perform this action.',
        details: {
          missingPermissions: evaluation.missingPermissions,
        },
      });
    }

    return true;
  }
}
