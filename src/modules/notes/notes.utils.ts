import { createHash, createHmac, randomBytes } from 'node:crypto';

export function slugifyNoteValue(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

  return normalized;
}

export function hashOpaqueToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function createWatermarkSeed() {
  return randomBytes(16).toString('hex');
}

export function signWatermarkPayload(
  payload: Record<string, unknown>,
  secret: string,
) {
  return createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function maskEmail(email: string) {
  const [localPart, domain = ''] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0] ?? '*'}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export function resolveUserAgent(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : null;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function parseByteRange(
  rangeHeader: string | undefined,
  totalLength: number,
) {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/u.exec(rangeHeader.trim());
  if (!match) {
    return {
      error: 'INVALID_RANGE_HEADER',
      message: 'Range header must be a valid byte range.',
    } as const;
  }

  let start: number;
  let end: number;

  if (match[1] === '' && match[2] === '') {
    return {
      error: 'INVALID_RANGE_HEADER',
      message: 'Range header must include a start or end byte.',
    } as const;
  }

  if (match[1] === '') {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return {
        error: 'INVALID_RANGE_HEADER',
        message: 'Range suffix must be a positive integer.',
      } as const;
    }

    start = Math.max(totalLength - suffixLength, 0);
    end = totalLength - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? totalLength - 1 : Number(match[2]);
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= totalLength
  ) {
    return {
      error: 'INVALID_RANGE_HEADER',
      message: 'Requested byte range is outside the file bounds.',
    } as const;
  }

  return {
    start,
    end: Math.min(end, totalLength - 1),
    length: Math.min(end, totalLength - 1) - start + 1,
  } as const;
}
