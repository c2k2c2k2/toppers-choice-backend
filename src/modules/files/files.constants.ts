import {
  FileAssetAccess,
  FileAssetPurpose,
} from '@prisma/client';

type FilePurposeRule = {
  allowedContentTypes: string[];
  maxSizeBytes: number;
  defaultAccessLevel: FileAssetAccess;
};

const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const FILE_PURPOSE_RULES: Record<FileAssetPurpose, FilePurposeRule> = {
  [FileAssetPurpose.NOTE_PDF]: {
    allowedContentTypes: ['application/pdf'],
    maxSizeBytes: 100 * 1024 * 1024,
    defaultAccessLevel: FileAssetAccess.PROTECTED,
  },
  [FileAssetPurpose.CMS_IMAGE]: {
    allowedContentTypes: [...IMAGE_CONTENT_TYPES],
    maxSizeBytes: 10 * 1024 * 1024,
    defaultAccessLevel: FileAssetAccess.PUBLIC,
  },
  [FileAssetPurpose.QUESTION_IMAGE]: {
    allowedContentTypes: [...IMAGE_CONTENT_TYPES],
    maxSizeBytes: 10 * 1024 * 1024,
    defaultAccessLevel: FileAssetAccess.PROTECTED,
  },
  [FileAssetPurpose.PROFILE_IMAGE]: {
    allowedContentTypes: [...IMAGE_CONTENT_TYPES],
    maxSizeBytes: 5 * 1024 * 1024,
    defaultAccessLevel: FileAssetAccess.AUTHENTICATED,
  },
  [FileAssetPurpose.CONTENT_IMAGE]: {
    allowedContentTypes: [...IMAGE_CONTENT_TYPES],
    maxSizeBytes: 10 * 1024 * 1024,
    defaultAccessLevel: FileAssetAccess.PROTECTED,
  },
  [FileAssetPurpose.GENERIC_PDF]: {
    allowedContentTypes: ['application/pdf'],
    maxSizeBytes: 25 * 1024 * 1024,
    defaultAccessLevel: FileAssetAccess.PROTECTED,
  },
  [FileAssetPurpose.GENERIC_IMAGE]: {
    allowedContentTypes: [...IMAGE_CONTENT_TYPES],
    maxSizeBytes: 10 * 1024 * 1024,
    defaultAccessLevel: FileAssetAccess.PROTECTED,
  },
};

export const FILE_UPLOAD_URL_TTL_SECONDS = 15 * 60;

export const FILE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isInlineAssetContentType(contentType: string) {
  return (
    contentType === 'application/pdf' || contentType.startsWith('image/')
  );
}
