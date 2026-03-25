export const QUESTION_CODE_PATTERN = /^[a-z0-9_-]+$/;
export const OPTION_KEY_PATTERN = /^[A-Z0-9_-]+$/;

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

export function extractSearchText(value: unknown): string[] {
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/gu, ' ');
    return normalized.length > 0 ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractSearchText(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      extractSearchText(item),
    );
  }

  return [];
}

export function buildQuestionSearchText(...values: unknown[]) {
  const text = values
    .flatMap((value) => extractSearchText(value))
    .join(' ')
    .trim();

  return text.length > 0 ? text : 'question';
}
