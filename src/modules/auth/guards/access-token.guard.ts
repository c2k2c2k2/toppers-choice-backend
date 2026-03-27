import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RefreshSessionStatus, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { userIdentitySelect } from '../../users/users.types';
import { AUTH_PUBLIC_ROUTE_KEY } from '../auth.constants';
import { AuthTokenService } from '../auth-token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authTokenService: AuthTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(
      AUTH_PUBLIC_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublicRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    const payload = await this.authTokenService.verifyAccessToken(token);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true,
        userId: true,
        siteId: true,
        status: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.siteId !== payload.siteId ||
      session.status !== RefreshSessionStatus.ACTIVE ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException({
        code: 'ACCESS_TOKEN_INVALID',
        message: 'Access token is invalid or expired.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: userIdentitySelect,
    });

    if (!user || user.siteId !== payload.siteId) {
      throw new UnauthorizedException({
        code: 'ACCESS_TOKEN_INVALID',
        message: 'Access token is invalid or expired.',
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'USER_SUSPENDED',
        message: 'This account is suspended.',
      });
    }

    request.user = {
      userId: user.id,
      siteId: user.siteId,
      sessionId: session.id,
      email: user.email,
      fullName: user.fullName,
      userType: user.userType,
      status: user.status,
    };

    return true;
  }

  private extractBearerToken(request: Request) {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Bearer access token is required.',
      });
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Bearer access token is required.',
      });
    }

    return token;
  }
}
