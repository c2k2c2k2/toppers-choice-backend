import { EnglishSpeakingLanguage } from '@prisma/client';

export const ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY = 'englishSpeaking.runtime';

export const ENGLISH_SPEAKING_MODEL_ID_PATH = 'tts.modelId';
export const ENGLISH_SPEAKING_OUTPUT_FORMAT_PATH = 'tts.outputFormat';
export const ENGLISH_SPEAKING_DEFAULT_VOICE_ID_PATH = 'tts.voiceIds.default';
export const ENGLISH_SPEAKING_VOICE_SETTINGS_STABILITY_PATH =
  'tts.voiceSettings.stability';
export const ENGLISH_SPEAKING_VOICE_SETTINGS_SIMILARITY_PATH =
  'tts.voiceSettings.similarityBoost';
export const ENGLISH_SPEAKING_VOICE_SETTINGS_STYLE_PATH =
  'tts.voiceSettings.style';
export const ENGLISH_SPEAKING_VOICE_SETTINGS_SPEED_PATH =
  'tts.voiceSettings.speed';
export const ENGLISH_SPEAKING_VOICE_SETTINGS_SPEAKER_BOOST_PATH =
  'tts.voiceSettings.useSpeakerBoost';

export const ENGLISH_SPEAKING_DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
export const ENGLISH_SPEAKING_DEFAULT_OUTPUT_FORMAT = 'mp3_22050_32';
export const ENGLISH_SPEAKING_DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';
export const ENGLISH_SPEAKING_AUDIO_CONTENT_TYPE = 'audio/mpeg';
export const ENGLISH_SPEAKING_AUDIO_EXTENSION = 'mp3';

export const ENGLISH_SPEAKING_AUDIO_LANGUAGES = [
  EnglishSpeakingLanguage.HINDI,
  EnglishSpeakingLanguage.MARATHI,
  EnglishSpeakingLanguage.ENGLISH,
] as const;

export const ENGLISH_SPEAKING_LANGUAGE_CONFIG: Record<
  EnglishSpeakingLanguage,
  {
    envVoiceIdKey: string;
    fileLabel: string;
    languageCode: string;
    voiceConfigPath: string;
  }
> = {
  [EnglishSpeakingLanguage.HINDI]: {
    envVoiceIdKey: 'ELEVENLABS_HINDI_VOICE_ID',
    fileLabel: 'hindi',
    languageCode: 'hi',
    voiceConfigPath: 'tts.voiceIds.hindi',
  },
  [EnglishSpeakingLanguage.MARATHI]: {
    envVoiceIdKey: 'ELEVENLABS_MARATHI_VOICE_ID',
    fileLabel: 'marathi',
    languageCode: 'mr',
    voiceConfigPath: 'tts.voiceIds.marathi',
  },
  [EnglishSpeakingLanguage.ENGLISH]: {
    envVoiceIdKey: 'ELEVENLABS_ENGLISH_VOICE_ID',
    fileLabel: 'english',
    languageCode: 'en',
    voiceConfigPath: 'tts.voiceIds.english',
  },
};
