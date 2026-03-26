export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptionalSlug(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, '')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');

  return normalized.length > 0 ? normalized : undefined;
}

export function cmsSlugify(value: string) {
  const normalized = normalizeOptionalSlug(value);
  return typeof normalized === 'string'
    ? normalized
    : `cms-${Date.now().toString(36)}`;
}
