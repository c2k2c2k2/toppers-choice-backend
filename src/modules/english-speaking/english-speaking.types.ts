import { createHash } from 'node:crypto';
import { EnglishSpeakingLanguage, Prisma } from '@prisma/client';
import { ENGLISH_SPEAKING_AUDIO_LANGUAGES } from './english-speaking.constants';

export const englishSpeakingSentenceAudioSelect =
  Prisma.validator<Prisma.EnglishSpeakingSentenceAudioSelect>()({
    id: true,
    language: true,
    previewFileAssetId: true,
    finalizedFileAssetId: true,
    voiceId: true,
    modelId: true,
    outputFormat: true,
    textHash: true,
    status: true,
    lastError: true,
    generatedAt: true,
    finalizedAt: true,
    createdAt: true,
    updatedAt: true,
  });

export const englishSpeakingSentenceSelect =
  Prisma.validator<Prisma.EnglishSpeakingSentenceSelect>()({
    id: true,
    orderIndex: true,
    hindiText: true,
    marathiText: true,
    englishText: true,
    createdAt: true,
    updatedAt: true,
    audioRecords: {
      select: englishSpeakingSentenceAudioSelect,
    },
  });

export const englishSpeakingTopicSelect =
  Prisma.validator<Prisma.EnglishSpeakingTopicSelect>()({
    id: true,
    siteId: true,
    slug: true,
    title: true,
    description: true,
    visibility: true,
    accessType: true,
    orderIndex: true,
    status: true,
    createdByUserId: true,
    updatedByUserId: true,
    publishedByUserId: true,
    publishedAt: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    site: {
      select: {
        code: true,
      },
    },
    sentences: {
      select: englishSpeakingSentenceSelect,
    },
  });

export type EnglishSpeakingSentenceAudioRecord =
  Prisma.EnglishSpeakingSentenceAudioGetPayload<{
    select: typeof englishSpeakingSentenceAudioSelect;
  }>;

export type EnglishSpeakingSentenceRecord =
  Prisma.EnglishSpeakingSentenceGetPayload<{
    select: typeof englishSpeakingSentenceSelect;
  }>;

export type EnglishSpeakingTopicRecord = Prisma.EnglishSpeakingTopicGetPayload<{
  select: typeof englishSpeakingTopicSelect;
}>;

export function hashEnglishSpeakingText(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

export function getSentenceText(
  sentence: Pick<
    EnglishSpeakingSentenceRecord,
    'hindiText' | 'marathiText' | 'englishText'
  >,
  language: EnglishSpeakingLanguage,
) {
  switch (language) {
    case EnglishSpeakingLanguage.HINDI:
      return sentence.hindiText;
    case EnglishSpeakingLanguage.MARATHI:
      return sentence.marathiText;
    case EnglishSpeakingLanguage.ENGLISH:
      return sentence.englishText;
  }
}

export function findSentenceAudioRecord(
  sentence: Pick<EnglishSpeakingSentenceRecord, 'audioRecords'>,
  language: EnglishSpeakingLanguage,
) {
  return sentence.audioRecords.find((record) => record.language === language);
}

export function isCurrentSentenceAudio(
  sentence: Pick<
    EnglishSpeakingSentenceRecord,
    'hindiText' | 'marathiText' | 'englishText'
  >,
  record: Pick<EnglishSpeakingSentenceAudioRecord, 'language' | 'textHash'>,
) {
  return (
    record.textHash ===
    hashEnglishSpeakingText(getSentenceText(sentence, record.language))
  );
}

export function countReadyEnglishSpeakingSentences(
  topic: Pick<EnglishSpeakingTopicRecord, 'sentences'>,
) {
  return topic.sentences.filter((sentence) =>
    ENGLISH_SPEAKING_AUDIO_LANGUAGES.every((language) => {
      const record = findSentenceAudioRecord(sentence, language);
      return Boolean(
        record?.finalizedFileAssetId &&
        record.textHash &&
        isCurrentSentenceAudio(sentence, record),
      );
    }),
  ).length;
}
