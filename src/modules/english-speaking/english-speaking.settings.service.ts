import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  ENGLISH_SPEAKING_DEFAULT_MODEL_ID,
  ENGLISH_SPEAKING_DEFAULT_OUTPUT_FORMAT,
  ENGLISH_SPEAKING_DEFAULT_VOICE_ID,
  ENGLISH_SPEAKING_DEFAULT_VOICE_ID_PATH,
  ENGLISH_SPEAKING_LANGUAGE_CONFIG,
  ENGLISH_SPEAKING_MODEL_ID_PATH,
  ENGLISH_SPEAKING_OUTPUT_FORMAT_PATH,
  ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
  ENGLISH_SPEAKING_VOICE_SETTINGS_SIMILARITY_PATH,
  ENGLISH_SPEAKING_VOICE_SETTINGS_SPEAKER_BOOST_PATH,
  ENGLISH_SPEAKING_VOICE_SETTINGS_SPEED_PATH,
  ENGLISH_SPEAKING_VOICE_SETTINGS_STABILITY_PATH,
  ENGLISH_SPEAKING_VOICE_SETTINGS_STYLE_PATH,
} from './english-speaking.constants';
import { EnglishSpeakingLanguage } from '@prisma/client';
import type { VoiceSettings } from '@elevenlabs/elevenlabs-js/api/types/VoiceSettings';

@Injectable()
export class EnglishSpeakingSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  async getGenerationConfig(
    siteId: string,
    language: EnglishSpeakingLanguage,
  ): Promise<{
    languageCode?: string;
    modelId: string;
    outputFormat: string;
    voiceId: string;
    voiceSettings: VoiceSettings;
  }> {
    const siteCode = await this.resolveSiteCode(siteId);
    const languageConfig = ENGLISH_SPEAKING_LANGUAGE_CONFIG[language];
    const modelId = await this.siteSettingsService.getStringSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_MODEL_ID_PATH,
      {
        siteCode,
        fallback: ENGLISH_SPEAKING_DEFAULT_MODEL_ID,
      },
    );
    const outputFormat = await this.siteSettingsService.getStringSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_OUTPUT_FORMAT_PATH,
      {
        siteCode,
        fallback: ENGLISH_SPEAKING_DEFAULT_OUTPUT_FORMAT,
      },
    );
    const defaultVoiceId = await this.siteSettingsService.getStringSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_DEFAULT_VOICE_ID_PATH,
      {
        siteCode,
        fallback: ENGLISH_SPEAKING_DEFAULT_VOICE_ID,
        envFallbackKey: 'ELEVENLABS_DEFAULT_VOICE_ID',
      },
    );
    const voiceId = await this.siteSettingsService.getStringSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      languageConfig.voiceConfigPath,
      {
        siteCode,
        fallback: defaultVoiceId,
        envFallbackKey: languageConfig.envVoiceIdKey,
      },
    );
    const stability = await this.siteSettingsService.getNumberSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_VOICE_SETTINGS_STABILITY_PATH,
      {
        siteCode,
        fallback: 0.4,
        max: 1,
        min: 0,
      },
    );
    const similarityBoost = await this.siteSettingsService.getNumberSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_VOICE_SETTINGS_SIMILARITY_PATH,
      {
        siteCode,
        fallback: 0.8,
        max: 1,
        min: 0,
      },
    );
    const style = await this.siteSettingsService.getNumberSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_VOICE_SETTINGS_STYLE_PATH,
      {
        siteCode,
        fallback: 0,
        max: 1,
        min: 0,
      },
    );
    const speed = await this.siteSettingsService.getNumberSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_VOICE_SETTINGS_SPEED_PATH,
      {
        siteCode,
        fallback: 1,
        max: 1.5,
        min: 0.7,
      },
    );
    const useSpeakerBoost = await this.siteSettingsService.getBooleanSetting(
      ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
      ENGLISH_SPEAKING_VOICE_SETTINGS_SPEAKER_BOOST_PATH,
      {
        siteCode,
        fallback: true,
      },
    );

    return {
      // Let the multilingual and v3 models infer the language from text.
      // This avoids Marathi failures we have seen when forcing language_code
      // and keeps v3 closer to the portal behavior that was approved.
      languageCode: this.shouldForceLanguageCode(modelId)
        ? languageConfig.languageCode
        : undefined,
      modelId,
      outputFormat,
      voiceId,
      voiceSettings: {
        similarityBoost,
        speed,
        stability,
        style,
        useSpeakerBoost,
      },
    };
  }

  private shouldForceLanguageCode(modelId: string) {
    return !(
      modelId === 'eleven_v3' || modelId.startsWith('eleven_multilingual_')
    );
  }

  private async resolveSiteCode(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        code: true,
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: 'SITE_NOT_FOUND',
        message: 'The active site context was not found.',
      });
    }

    return site.code;
  }
}
