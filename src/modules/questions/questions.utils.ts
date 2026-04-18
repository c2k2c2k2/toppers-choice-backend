import {
  extractQuestionSearchFragments,
  extractTextFromQuestionHtml,
} from './question-rich-content.util';

export const QUESTION_CODE_PATTERN = /^[a-z0-9_-]+$/;
export const OPTION_KEY_PATTERN = /^[A-Z0-9_-]+$/;
export type QuestionLocale = 'en' | 'mr';

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptionalCode(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptionKey(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function buildQuestionSearchText(...values: unknown[]) {
  const text = values
    .flatMap((value) => extractQuestionSearchFragments(value))
    .join(' ')
    .trim();

  return text.length > 0 ? text : 'question';
}

export function buildQuestionStatementPreviewText(
  value: unknown,
  maxLength = 180,
) {
  const text = extractQuestionContentText(value);
  if (!text) {
    return 'Question statement unavailable.';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getQuestionLocalizedValue(
  value: unknown,
  locale: QuestionLocale,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const localeKeys = locale === 'en' ? ['en-IN', 'en'] : ['mr-IN', 'mr'];
  for (const localeKey of localeKeys) {
    if (value[localeKey] !== undefined) {
      return value[localeKey];
    }
  }

  if (isRecord(value.translations)) {
    for (const localeKey of localeKeys) {
      if (value.translations[localeKey] !== undefined) {
        return value.translations[localeKey];
      }
    }
  }

  return value;
}

function extractStructuredStatementText(value: Record<string, unknown>): string {
  const fragments: string[] = [];

  if (typeof value.html === 'string') {
    const htmlText = extractTextFromQuestionHtml(value.html);
    if (htmlText) {
      fragments.push(htmlText);
    }
  }

  ['text', 'contentHtml', 'content', 'body'].forEach((key) => {
    const entry = value[key];
    if (typeof entry === 'string' && entry.trim()) {
      fragments.push(
        key.toLowerCase().includes('html')
          ? extractTextFromQuestionHtml(entry)
          : entry.trim(),
      );
    }
  });

  if (Array.isArray(value.blocks)) {
    value.blocks.forEach((block) => {
      const blockText = extractQuestionContentText(block);
      if (blockText) {
        fragments.push(blockText);
      }
    });
  }

  return fragments.join(' ').replace(/\s+/gu, ' ').trim();
}

export function extractQuestionContentText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => extractQuestionContentText(entry))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  if (!isRecord(value)) {
    return '';
  }

  if (
    Array.isArray(value.blocks) ||
    typeof value.html === 'string' ||
    typeof value.text === 'string' ||
    typeof value.contentHtml === 'string' ||
    typeof value.content === 'string' ||
    typeof value.body === 'string'
  ) {
    return extractStructuredStatementText(value);
  }

  const localeCandidates = [
    'mr-IN',
    'mr',
    'en-IN',
    'en',
    'default',
    'content',
    'body',
  ];

  for (const localeKey of localeCandidates) {
    if (value[localeKey] !== undefined) {
      const localizedText = extractQuestionContentText(value[localeKey]);
      if (localizedText) {
        return localizedText;
      }
    }
  }

  if (isRecord(value.translations)) {
    const translatedText = extractQuestionContentText(value.translations);
    if (translatedText) {
      return translatedText;
    }
  }

  return Object.values(value)
    .map((entry) => extractQuestionContentText(entry))
    .find((entry) => entry.length > 0) ?? '';
}

export function hasMeaningfulQuestionContent(value: unknown): boolean {
  return extractQuestionContentText(value).length > 0;
}
