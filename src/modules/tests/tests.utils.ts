export const TEST_CODE_PATTERN = /^[a-z0-9_-]+$/;

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptionalCode(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function slugifyTestValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function buildTestSearchText(
  ...parts: Array<string | null | undefined>
) {
  return parts
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' ')
    .toLowerCase();
}

export function shuffleArray<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function normalizeAnswerText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeOptionKeys(value: string[]) {
  return Array.from(
    new Set(
      value
        .map((item) => item.trim().toUpperCase())
        .filter((item) => item.length > 0),
    ),
  ).sort();
}

export function clampPercentage(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

export function calculatePercentage(score: number, maxScore: number) {
  if (maxScore <= 0) {
    return 0;
  }

  return clampPercentage(Math.round((score / maxScore) * 100));
}

export function isTestLive(
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  publishedAt: Date | null,
  availableFrom: Date | null,
  availableUntil: Date | null,
) {
  if (status !== 'PUBLISHED') {
    return false;
  }

  const now = new Date();
  if (publishedAt && publishedAt > now) {
    return false;
  }

  if (availableFrom && availableFrom > now) {
    return false;
  }

  if (availableUntil && availableUntil < now) {
    return false;
  }

  return true;
}
