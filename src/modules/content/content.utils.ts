export function slugifyContentValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function isContentLive(
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  publishedAt: Date | null,
) {
  if (status !== 'PUBLISHED') {
    return false;
  }

  return !publishedAt || publishedAt <= new Date();
}

export function isContentScheduled(
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  publishedAt: Date | null,
) {
  return (
    status === 'PUBLISHED' && Boolean(publishedAt && publishedAt > new Date())
  );
}
