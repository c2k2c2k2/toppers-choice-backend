import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentFamily,
  ContentFormat,
  ContentStatus,
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  UserStatus,
  UserType,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { ObjectStorageService } from '../src/infra/storage/object-storage.service';

type ImportPdfInput = {
  filePath: string;
  originalFileName: string;
};

type ResolvedContext = {
  actorUserId: string;
  siteCode: string;
  siteId: string;
};

const PDF_CONTENT_TYPE = 'application/pdf';
const PDF_ACCESS_LEVEL = FileAssetAccess.AUTHENTICATED;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const objectStorageService = app.get(ObjectStorageService);
    const context = await resolveContext(prisma);

    await objectStorageService.assertBucketReachable();

    const careerEnglishAsset = await upsertPdfAsset(
      prisma,
      objectStorageService,
      context,
      {
        filePath: '.tmp/pdf-imports/career-english.pdf',
        originalFileName: 'Career Guidance_English Language.pdf',
      },
    );
    const careerMarathiAsset = await upsertPdfAsset(
      prisma,
      objectStorageService,
      context,
      {
        filePath: '.tmp/pdf-imports/career-marathi.pdf',
        originalFileName: 'Career Guidance_Marathi Language.pdf',
      },
    );
    const englishSpeakingAsset = await upsertPdfAsset(
      prisma,
      objectStorageService,
      context,
      {
        filePath: '.tmp/pdf-imports/english-speaking-book.pdf',
        originalFileName: 'English Speaking Book.pdf',
      },
    );

    const englishMedium = await resolveMedium(prisma, context.siteId, [
      'english',
      'ENGLISH',
      'en',
    ]);
    const marathiMedium = await resolveMedium(prisma, context.siteId, [
      'marathi',
      'MARATHI',
      'mr',
    ]);

    const careerEnglish = await upsertCareerContent(prisma, context, {
      assetId: careerEnglishAsset.id,
      excerpt:
        'Consolidated English career guidance PDF for exam and service pathways.',
      label: 'Career Guidance - English',
      mediumId: englishMedium.id,
      slug: 'career-guidance-english-pdf',
      title: 'Career Guidance - English',
    });
    const careerMarathi = await upsertCareerContent(prisma, context, {
      assetId: careerMarathiAsset.id,
      excerpt:
        'Consolidated Marathi career guidance PDF for exam and service pathways.',
      label: 'Career Guidance - Marathi',
      mediumId: marathiMedium.id,
      slug: 'career-guidance-marathi-pdf',
      title: 'Career Guidance - Marathi',
    });
    const material = await upsertEnglishSpeakingMaterial(
      prisma,
      context,
      englishSpeakingAsset.id,
    );

    console.log('PDF material import complete.');
    console.log(
      `Career English: content=${careerEnglish.id}, asset=${careerEnglishAsset.id}`,
    );
    console.log(
      `Career Marathi: content=${careerMarathi.id}, asset=${careerMarathiAsset.id}`,
    );
    console.log(
      `English speaking material: material=${material.id}, asset=${englishSpeakingAsset.id}`,
    );
  } finally {
    await app.close();
  }
}

async function resolveContext(prisma: PrismaService): Promise<ResolvedContext> {
  const siteCode = process.env.DEFAULT_SITE_CODE ?? 'toppers-choice';
  const site = await prisma.site.findFirst({
    where: {
      code: siteCode,
      status: 'ACTIVE',
    },
    select: {
      code: true,
      id: true,
    },
  });

  if (!site) {
    throw new Error(`Active site "${siteCode}" was not found.`);
  }

  const actor = await prisma.user.findFirst({
    where: {
      siteId: site.id,
      status: UserStatus.ACTIVE,
      userType: UserType.ADMIN,
    },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
    },
  });

  if (!actor) {
    throw new Error('No active admin user was found for PDF import ownership.');
  }

  return {
    actorUserId: actor.id,
    siteCode: site.code,
    siteId: site.id,
  };
}

async function upsertPdfAsset(
  prisma: PrismaService,
  objectStorageService: ObjectStorageService,
  context: ResolvedContext,
  input: ImportPdfInput,
) {
  const [buffer, fileStat] = await Promise.all([
    readFile(input.filePath),
    stat(input.filePath),
  ]);
  const checksumSha256 = createHash('sha256').update(buffer).digest('hex');
  const existing = await prisma.fileAsset.findFirst({
    where: {
      checksumSha256,
      contentType: PDF_CONTENT_TYPE,
      originalFileName: input.originalFileName,
      purpose: FileAssetPurpose.GENERIC_PDF,
      siteId: context.siteId,
      status: FileAssetStatus.READY,
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing;
  }

  const objectKey = buildObjectKey(context.siteCode, input.originalFileName);
  const metadata = await objectStorageService.writeObject({
    body: buffer,
    contentType: PDF_CONTENT_TYPE,
    objectKey,
  });

  return prisma.fileAsset.create({
    data: {
      accessLevel: PDF_ACCESS_LEVEL,
      checksumSha256,
      confirmedAt: new Date(),
      confirmedByUserId: context.actorUserId,
      contentType: PDF_CONTENT_TYPE,
      createdByUserId: context.actorUserId,
      declaredSizeBytes: fileStat.size,
      etag: metadata.eTag,
      extension: 'pdf',
      objectKey,
      originalFileName: input.originalFileName,
      purpose: FileAssetPurpose.GENERIC_PDF,
      siteId: context.siteId,
      sizeBytes: metadata.contentLength ?? fileStat.size,
      status: FileAssetStatus.READY,
    },
    select: {
      id: true,
    },
  });
}

async function resolveMedium(
  prisma: PrismaService,
  siteId: string,
  candidates: string[],
) {
  const medium = await prisma.medium.findFirst({
    where: {
      OR: candidates.flatMap((candidate) => [
        {
          code: {
            equals: candidate,
            mode: 'insensitive' as const,
          },
        },
        {
          slug: {
            equals: candidate,
            mode: 'insensitive' as const,
          },
        },
        {
          name: {
            equals: candidate,
            mode: 'insensitive' as const,
          },
        },
      ]),
      isActive: true,
      siteId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!medium) {
    throw new Error(
      `Medium not found for candidates: ${candidates.join(', ')}`,
    );
  }

  return medium;
}

async function upsertCareerContent(
  prisma: PrismaService,
  context: ResolvedContext,
  input: {
    assetId: string;
    excerpt: string;
    label: string;
    mediumId: string;
    slug: string;
    title: string;
  },
) {
  const existing = await prisma.contentEntry.findUnique({
    where: {
      siteId_slug: {
        siteId: context.siteId,
        slug: input.slug,
      },
    },
    select: {
      id: true,
    },
  });
  const content = existing
    ? await prisma.contentEntry.update({
        where: {
          id: existing.id,
        },
        data: {
          accessType: ContentAccessType.FREE,
          bodyJson: {
            blocks: [],
          },
          excerpt: input.excerpt,
          family: ContentFamily.CAREER_GUIDANCE,
          format: ContentFormat.ARTICLE,
          publishedAt: new Date(),
          publishedByUserId: context.actorUserId,
          status: ContentStatus.PUBLISHED,
          title: input.title,
          updatedByUserId: context.actorUserId,
          visibility: CatalogVisibility.AUTHENTICATED,
        },
        select: {
          id: true,
        },
      })
    : await prisma.contentEntry.create({
        data: {
          accessType: ContentAccessType.FREE,
          bodyJson: {
            blocks: [],
          },
          createdByUserId: context.actorUserId,
          excerpt: input.excerpt,
          family: ContentFamily.CAREER_GUIDANCE,
          format: ContentFormat.ARTICLE,
          publishedAt: new Date(),
          publishedByUserId: context.actorUserId,
          siteId: context.siteId,
          slug: input.slug,
          status: ContentStatus.PUBLISHED,
          title: input.title,
          updatedByUserId: context.actorUserId,
          visibility: CatalogVisibility.AUTHENTICATED,
        },
        select: {
          id: true,
        },
      });

  await prisma.$transaction(async (tx) => {
    await tx.contentEntryMedium.deleteMany({
      where: {
        contentEntryId: content.id,
      },
    });
    await tx.contentEntryMedium.create({
      data: {
        contentEntryId: content.id,
        mediumId: input.mediumId,
      },
    });
    await tx.contentAttachment.deleteMany({
      where: {
        contentEntryId: content.id,
      },
    });
    await tx.contentAttachment.create({
      data: {
        contentEntryId: content.id,
        fileAssetId: input.assetId,
        label: input.label,
        orderIndex: 10,
      },
    });
    await tx.fileAssetReference.deleteMany({
      where: {
        resourceId: content.id,
        resourceType: 'content_entry',
        siteId: context.siteId,
      },
    });
    await tx.fileAssetReference.create({
      data: {
        accessLevel: FileAssetAccess.AUTHENTICATED,
        fileAssetId: input.assetId,
        resourceId: content.id,
        resourceType: 'content_entry',
        siteId: context.siteId,
        slot: 'attachment:0',
      },
    });
  });

  return content;
}

async function upsertEnglishSpeakingMaterial(
  prisma: PrismaService,
  context: ResolvedContext,
  assetId: string,
) {
  return prisma.$transaction(async (tx) => {
    const material = await tx.englishSpeakingMaterial.upsert({
      where: {
        siteId: context.siteId,
      },
      update: {
        notesFileAssetId: assetId,
        updatedByUserId: context.actorUserId,
      },
      create: {
        notesFileAssetId: assetId,
        siteId: context.siteId,
        updatedByUserId: context.actorUserId,
      },
      select: {
        id: true,
      },
    });

    await tx.fileAssetReference.deleteMany({
      where: {
        resourceId: material.id,
        resourceType: 'english_speaking_material',
        siteId: context.siteId,
      },
    });
    await tx.fileAssetReference.create({
      data: {
        accessLevel: FileAssetAccess.AUTHENTICATED,
        fileAssetId: assetId,
        resourceId: material.id,
        resourceType: 'english_speaking_material',
        siteId: context.siteId,
        slot: 'notes_pdf',
      },
    });

    return material;
  });
}

function buildObjectKey(siteCode: string, fileName: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeName = basename(fileName, '.pdf')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');

  return [
    'sites',
    siteCode,
    'generic_pdf',
    year,
    month,
    `${safeName}-${randomUUID()}.pdf`,
  ].join('/');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
