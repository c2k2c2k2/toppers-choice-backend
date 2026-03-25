import { Injectable } from '@nestjs/common';
import { NOTE_VIEW_TOKEN_TTL_MINUTES_FALLBACK } from '../auth/auth.constants';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  NOTES_PREVIEW_DEFAULT_PAGE_COUNT_PATH,
  NOTES_RUNTIME_CONFIG_KEY,
  NOTES_VIEW_SESSION_TTL_MINUTES_PATH,
  NOTES_WATERMARK_ENABLED_PATH,
} from './notes.constants';

@Injectable()
export class NotesSettingsService {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  async getViewSessionTtlMinutes(siteId?: string) {
    return this.siteSettingsService.getNumberSetting(
      NOTES_RUNTIME_CONFIG_KEY,
      NOTES_VIEW_SESSION_TTL_MINUTES_PATH,
      {
        siteCode: undefined,
        fallback: NOTE_VIEW_TOKEN_TTL_MINUTES_FALLBACK,
        min: 5,
        max: 120,
        integer: true,
      },
    );
  }

  async getDefaultPreviewPageCount() {
    return this.siteSettingsService.getNumberSetting(
      NOTES_RUNTIME_CONFIG_KEY,
      NOTES_PREVIEW_DEFAULT_PAGE_COUNT_PATH,
      {
        fallback: 3,
        min: 1,
        max: 50,
        integer: true,
      },
    );
  }

  async isWatermarkEnabled() {
    return this.siteSettingsService.getBooleanSetting(
      NOTES_RUNTIME_CONFIG_KEY,
      NOTES_WATERMARK_ENABLED_PATH,
      {
        fallback: true,
      },
    );
  }
}
