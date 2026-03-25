export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateAccuracyPercent(
  correctCount: number,
  answeredCount: number,
) {
  if (answeredCount <= 0) {
    return 0;
  }

  return Math.round((correctCount / answeredCount) * 100);
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

export function getDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
