import { Injectable } from '@nestjs/common';
import { ConfigVisibility } from '@prisma/client';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  ACCESS_TOKEN_TTL_MINUTES_PATH,
  AUTH_RUNTIME_CONFIG_KEY,
  PASSWORD_RESET_CODE_TTL_MINUTES_PATH,
  PASSWORD_RESET_MAX_ATTEMPTS_PATH,
  REFRESH_TOKEN_TTL_DAYS_PATH,
} from './auth.constants';

@Injectable()
export class AuthSettingsService {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  async getTokenSettings(siteCode?: string) {
    const [
      accessTokenTtlMinutes,
      refreshTokenTtlDays,
      passwordResetCodeTtlMinutes,
      passwordResetMaxAttempts,
    ] = await Promise.all([
      this.siteSettingsService.getNumberSetting(
        AUTH_RUNTIME_CONFIG_KEY,
        ACCESS_TOKEN_TTL_MINUTES_PATH,
        {
          siteCode,
          visibility: ConfigVisibility.INTERNAL,
          fallback: 15,
          integer: true,
          min: 5,
          max: 1_440,
        },
      ),
      this.siteSettingsService.getNumberSetting(
        AUTH_RUNTIME_CONFIG_KEY,
        REFRESH_TOKEN_TTL_DAYS_PATH,
        {
          siteCode,
          visibility: ConfigVisibility.INTERNAL,
          fallback: 30,
          integer: true,
          min: 1,
          max: 365,
        },
      ),
      this.siteSettingsService.getNumberSetting(
        AUTH_RUNTIME_CONFIG_KEY,
        PASSWORD_RESET_CODE_TTL_MINUTES_PATH,
        {
          siteCode,
          visibility: ConfigVisibility.INTERNAL,
          fallback: 15,
          integer: true,
          min: 5,
          max: 180,
        },
      ),
      this.siteSettingsService.getNumberSetting(
        AUTH_RUNTIME_CONFIG_KEY,
        PASSWORD_RESET_MAX_ATTEMPTS_PATH,
        {
          siteCode,
          visibility: ConfigVisibility.INTERNAL,
          fallback: 5,
          integer: true,
          min: 1,
          max: 20,
        },
      ),
    ]);

    return {
      accessTokenTtlMinutes,
      refreshTokenTtlDays,
      passwordResetCodeTtlMinutes,
      passwordResetMaxAttempts,
    };
  }
}
