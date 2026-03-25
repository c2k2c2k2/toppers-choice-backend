import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeEach(() => {
    const configService = {
      get: (key: string) =>
        ({
          JWT_ACCESS_SECRET: 'unit-test-access-secret',
          JWT_REFRESH_SECRET: 'unit-test-refresh-secret',
        })[key],
    } as ConfigService;

    service = new AuthTokenService(new JwtService({}), configService);
  });

  it('issues and verifies access and refresh tokens independently', async () => {
    const accessToken = await service.issueAccessToken(
      {
        sub: 'user_1',
        siteId: 'site_1',
        sessionId: 'session_1',
        userType: UserType.STUDENT,
      },
      15,
    );
    const refreshToken = await service.issueRefreshToken(
      {
        sub: 'user_1',
        siteId: 'site_1',
        sessionId: 'session_1',
        familyId: 'family_1',
        userType: UserType.STUDENT,
      },
      30,
    );

    await expect(service.verifyAccessToken(accessToken)).resolves.toMatchObject(
      {
        sub: 'user_1',
        siteId: 'site_1',
        sessionId: 'session_1',
        tokenType: 'access',
      },
    );
    await expect(
      service.verifyRefreshToken(refreshToken),
    ).resolves.toMatchObject({
      sub: 'user_1',
      siteId: 'site_1',
      sessionId: 'session_1',
      familyId: 'family_1',
      tokenType: 'refresh',
    });
  });

  it('rejects a refresh token passed into the access-token verifier', async () => {
    const refreshToken = await service.issueRefreshToken(
      {
        sub: 'user_1',
        siteId: 'site_1',
        sessionId: 'session_1',
        familyId: 'family_1',
        userType: UserType.ADMIN,
      },
      30,
    );

    await expect(service.verifyAccessToken(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
