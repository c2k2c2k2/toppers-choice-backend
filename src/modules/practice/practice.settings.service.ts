import { Injectable } from '@nestjs/common';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  PRACTICE_DEFAULT_BATCH_SIZE_PATH,
  PRACTICE_DEFAULT_QUESTION_COUNT_PATH,
  PRACTICE_MAX_BATCH_SIZE_PATH,
  PRACTICE_MAX_QUESTION_COUNT_PATH,
  PRACTICE_RUNTIME_CONFIG_KEY,
  PRACTICE_TREND_WINDOW_DAYS_PATH,
} from './practice.constants';

@Injectable()
export class PracticeSettingsService {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  async getDefaultBatchSize() {
    return this.siteSettingsService.getNumberSetting(
      PRACTICE_RUNTIME_CONFIG_KEY,
      PRACTICE_DEFAULT_BATCH_SIZE_PATH,
      {
        fallback: 10,
        min: 1,
        max: 50,
        integer: true,
      },
    );
  }

  async getMaxBatchSize() {
    return this.siteSettingsService.getNumberSetting(
      PRACTICE_RUNTIME_CONFIG_KEY,
      PRACTICE_MAX_BATCH_SIZE_PATH,
      {
        fallback: 20,
        min: 1,
        max: 100,
        integer: true,
      },
    );
  }

  async getDefaultQuestionCount() {
    return this.siteSettingsService.getNumberSetting(
      PRACTICE_RUNTIME_CONFIG_KEY,
      PRACTICE_DEFAULT_QUESTION_COUNT_PATH,
      {
        fallback: 20,
        min: 1,
        max: 200,
        integer: true,
      },
    );
  }

  async getMaxQuestionCount() {
    return this.siteSettingsService.getNumberSetting(
      PRACTICE_RUNTIME_CONFIG_KEY,
      PRACTICE_MAX_QUESTION_COUNT_PATH,
      {
        fallback: 100,
        min: 1,
        max: 500,
        integer: true,
      },
    );
  }

  async getTrendWindowDays() {
    return this.siteSettingsService.getNumberSetting(
      PRACTICE_RUNTIME_CONFIG_KEY,
      PRACTICE_TREND_WINDOW_DAYS_PATH,
      {
        fallback: 7,
        min: 1,
        max: 30,
        integer: true,
      },
    );
  }
}
