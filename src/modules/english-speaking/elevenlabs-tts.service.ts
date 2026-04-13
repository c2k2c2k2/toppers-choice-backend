import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { VoiceSettings } from '@elevenlabs/elevenlabs-js/api/types/VoiceSettings';

@Injectable()
export class ElevenLabsTtsService {
  private readonly client: ElevenLabsClient | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('ELEVENLABS_API_KEY')?.trim() ?? '';

    this.client = apiKey.length > 0 ? new ElevenLabsClient({ apiKey }) : null;
  }

  isConfigured() {
    return this.client !== null;
  }

  async generateSpeech(input: {
    languageCode?: string;
    modelId: string;
    outputFormat: string;
    text: string;
    voiceId: string;
    voiceSettings: VoiceSettings;
  }) {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'ELEVENLABS_NOT_CONFIGURED',
        message:
          'ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the backend environment before generating audio.',
      });
    }

    const response = await this.client.textToSpeech.convert(input.voiceId, {
      modelId: input.modelId,
      outputFormat: input.outputFormat as never,
      text: input.text,
      voiceSettings: input.voiceSettings,
      ...(input.languageCode
        ? {
            languageCode: input.languageCode,
          }
        : {}),
    });

    const arrayBuffer = await new Response(response).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
