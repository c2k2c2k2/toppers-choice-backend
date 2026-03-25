import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenPayload,
  NoteViewTokenPayload,
  RefreshTokenPayload,
} from './auth.types';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueAccessToken(
    payload: Omit<AccessTokenPayload, 'tokenType'>,
    expiresInMinutes: number,
  ) {
    return this.jwtService.signAsync(
      {
        ...payload,
        tokenType: 'access',
      },
      {
        secret: this.getAccessSecret(),
        expiresIn: `${expiresInMinutes}m`,
      },
    );
  }

  async issueRefreshToken(
    payload: Omit<RefreshTokenPayload, 'tokenType'>,
    expiresInDays: number,
  ) {
    return this.jwtService.signAsync(
      {
        ...payload,
        tokenType: 'refresh',
      },
      {
        secret: this.getRefreshSecret(),
        expiresIn: `${expiresInDays}d`,
      },
    );
  }

  async issueNoteViewToken(
    payload: Omit<NoteViewTokenPayload, 'tokenType'>,
    expiresInMinutes: number,
  ) {
    return this.jwtService.signAsync(
      {
        ...payload,
        tokenType: 'note_view',
      },
      {
        secret: this.getAccessSecret(),
        expiresIn: `${expiresInMinutes}m`,
      },
    );
  }

  async verifyAccessToken(token: string) {
    return this.verifyToken<AccessTokenPayload>(
      token,
      'access',
      this.getAccessSecret(),
      'ACCESS_TOKEN_INVALID',
    );
  }

  async verifyRefreshToken(token: string) {
    return this.verifyToken<RefreshTokenPayload>(
      token,
      'refresh',
      this.getRefreshSecret(),
      'REFRESH_TOKEN_INVALID',
    );
  }

  async verifyNoteViewToken(token: string) {
    return this.verifyToken<NoteViewTokenPayload>(
      token,
      'note_view',
      this.getAccessSecret(),
      'NOTE_VIEW_TOKEN_INVALID',
    );
  }

  private async verifyToken<T extends { tokenType: string }>(
    token: string,
    expectedType: T['tokenType'],
    secret: string,
    code: string,
  ) {
    try {
      const payload = await this.jwtService.verifyAsync<T>(token, {
        secret,
      });

      if (payload.tokenType !== expectedType) {
        throw new UnauthorizedException();
      }

      return payload;
    } catch {
      throw new UnauthorizedException({
        code,
        message: 'Token is invalid or expired.',
      });
    }
  }

  private getAccessSecret() {
    return this.configService.get<string>('JWT_ACCESS_SECRET') ?? '';
  }

  private getRefreshSecret() {
    return this.configService.get<string>('JWT_REFRESH_SECRET') ?? '';
  }
}
