import { extname } from 'node:path';

type ContentDispositionType = 'attachment' | 'inline';

export function buildContentDispositionHeader(
  dispositionType: ContentDispositionType,
  originalFileName: string,
) {
  const normalizedFileName = originalFileName
    .replaceAll(/[\r\n]+/g, ' ')
    .trim();
  const fallbackFileName = buildAsciiFallbackFileName(normalizedFileName);
  const encodedFileName = encodeURIComponent(normalizedFileName).replaceAll(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${dispositionType}; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
}

function buildAsciiFallbackFileName(originalFileName: string) {
  const extension = extname(originalFileName)
    .replaceAll(/[^A-Za-z0-9.]+/g, '')
    .toLowerCase();
  const stem = originalFileName.slice(
    0,
    extension.length > 0
      ? Math.max(0, originalFileName.length - extension.length)
      : originalFileName.length,
  );

  const sanitizedStem = stem
    .normalize('NFKD')
    .replaceAll(/[^\x20-\x7E]+/g, '')
    .replaceAll(/["\\]/g, '')
    .replaceAll(/[^A-Za-z0-9._ -]+/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replaceAll(/^[.\- ]+|[.\- ]+$/g, '');

  const safeStem = sanitizedStem.length > 0 ? sanitizedStem : 'file';
  return `${safeStem}${extension || '.bin'}`;
}
