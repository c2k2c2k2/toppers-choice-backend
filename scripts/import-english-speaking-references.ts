import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  CatalogVisibility,
  ContentAccessType,
  UserStatus,
  UserType,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types';
import { slugifyContentValue } from '../src/modules/content/content.utils';
import { EnglishSpeakingService } from '../src/modules/english-speaking/english-speaking.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';

type ReferenceSentence = {
  english: string;
  hindi: string;
  marathi: string;
};

type ReferenceDocument = {
  data: ReferenceSentence[];
  document_title?: string;
};

type ImportOptions = {
  accessType: ContentAccessType;
  adminEmail?: string;
  directory: string;
  siteCode?: string;
  skipExisting: boolean;
  visibility: CatalogVisibility;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const englishSpeakingService = app.get(EnglishSpeakingService);
    const actor = await resolveActor(prisma, options);

    const fileNames = (await readdir(options.directory))
      .filter((fileName) => {
        const extension = extname(fileName).toLowerCase();
        return extension === '.txt' || extension === '.json';
      })
      .sort((left, right) => left.localeCompare(right));

    if (fileNames.length === 0) {
      throw new Error(
        `No .txt or .json reference files were found in ${options.directory}.`,
      );
    }

    const results: Array<{
      sentenceCount: number;
      slug: string;
      status: 'created' | 'skipped' | 'updated';
      title: string;
    }> = [];

    for (const fileName of fileNames) {
      const filePath = join(options.directory, fileName);
      const document = await loadReferenceDocument(filePath);
      const title =
        document.document_title?.trim() ||
        basename(fileName, extname(fileName));
      const slug = slugifyContentValue(basename(fileName, extname(fileName)));
      const sentences = document.data.map((sentence, index) => ({
        englishText: sentence.english.trim(),
        hindiText: sentence.hindi.trim(),
        marathiText: sentence.marathi.trim(),
        orderIndex: (index + 1) * 10,
      }));

      const existingTopic = await prisma.englishSpeakingTopic.findFirst({
        where: {
          siteId: actor.siteId,
          slug,
        },
        select: {
          id: true,
          sentences: {
            select: {
              id: true,
            },
            orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });

      if (existingTopic) {
        if (options.skipExisting) {
          results.push({
            sentenceCount: sentences.length,
            slug,
            status: 'skipped',
            title,
          });
          continue;
        }

        await englishSpeakingService.updateTopic(actor, existingTopic.id, {
          accessType: options.accessType,
          sentences: sentences.map((sentence, index) => ({
            ...sentence,
            id: existingTopic.sentences[index]?.id,
          })),
          slug,
          title,
          visibility: options.visibility,
        });

        results.push({
          sentenceCount: sentences.length,
          slug,
          status: 'updated',
          title,
        });
        continue;
      }

      await englishSpeakingService.createTopic(actor, {
        accessType: options.accessType,
        sentences,
        slug,
        title,
        visibility: options.visibility,
      });

      results.push({
        sentenceCount: sentences.length,
        slug,
        status: 'created',
        title,
      });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const result of results) {
      if (result.status === 'created') {
        createdCount += 1;
      } else if (result.status === 'updated') {
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }

      console.log(
        `${result.status.toUpperCase()} ${result.slug} (${result.sentenceCount} sentences) - ${result.title}`,
      );
    }

    console.log(
      `English speaking import complete: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
    );
  } finally {
    await app.close();
  }
}

function parseArgs(argv: string[]): ImportOptions {
  let directory = join(
    process.cwd(),
    'references',
    'client requirements',
    'english-speaking',
  );
  let adminEmail: string | undefined;
  let siteCode: string | undefined;
  let skipExisting = false;
  let visibility: CatalogVisibility = CatalogVisibility.AUTHENTICATED;
  let accessType: ContentAccessType = ContentAccessType.FREE;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith('--')) {
      continue;
    }

    const [flag, inlineValue] = value.split('=', 2);
    const nextValue = inlineValue ?? argv[index + 1];

    switch (flag) {
      case '--dir':
        directory = requireValue(flag, nextValue);
        if (!inlineValue) {
          index += 1;
        }
        break;
      case '--admin-email':
        adminEmail = requireValue(flag, nextValue).trim().toLowerCase();
        if (!inlineValue) {
          index += 1;
        }
        break;
      case '--site-code':
        siteCode = requireValue(flag, nextValue).trim();
        if (!inlineValue) {
          index += 1;
        }
        break;
      case '--skip-existing':
        skipExisting = true;
        break;
      case '--visibility':
        visibility = parseVisibility(requireValue(flag, nextValue));
        if (!inlineValue) {
          index += 1;
        }
        break;
      case '--access-type':
        accessType = parseAccessType(requireValue(flag, nextValue));
        if (!inlineValue) {
          index += 1;
        }
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  return {
    accessType,
    adminEmail,
    directory,
    siteCode,
    skipExisting,
    visibility,
  };
}

function requireValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function parseVisibility(value: string) {
  switch (value.trim().toUpperCase()) {
    case CatalogVisibility.PUBLIC:
      return CatalogVisibility.PUBLIC;
    case CatalogVisibility.AUTHENTICATED:
      return CatalogVisibility.AUTHENTICATED;
    case CatalogVisibility.INTERNAL:
      return CatalogVisibility.INTERNAL;
    default:
      throw new Error(
        `Unsupported visibility "${value}". Use PUBLIC, AUTHENTICATED, or INTERNAL.`,
      );
  }
}

function parseAccessType(value: string) {
  switch (value.trim().toUpperCase()) {
    case ContentAccessType.FREE:
      return ContentAccessType.FREE;
    case ContentAccessType.PREMIUM:
      return ContentAccessType.PREMIUM;
    default:
      throw new Error(
        `Unsupported access type "${value}". Use FREE or PREMIUM.`,
      );
  }
}

async function resolveActor(
  prisma: PrismaService,
  options: ImportOptions,
): Promise<AuthenticatedUser> {
  const site = await prisma.site.findFirst({
    where: options.siteCode
      ? {
          code: options.siteCode,
        }
      : {
          isDefault: true,
        },
    select: {
      id: true,
      code: true,
    },
  });

  if (!site) {
    throw new Error(
      options.siteCode
        ? `Site "${options.siteCode}" was not found.`
        : 'Default site was not found.',
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      siteId: site.id,
      userType: UserType.ADMIN,
      status: UserStatus.ACTIVE,
      ...(options.adminEmail
        ? {
            email: options.adminEmail,
          }
        : {}),
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      email: true,
      fullName: true,
      id: true,
      siteId: true,
      status: true,
      userType: true,
    },
  });

  if (!user) {
    throw new Error(
      options.adminEmail
        ? `Active admin user "${options.adminEmail}" was not found for site "${site.code}".`
        : `No active admin user was found for site "${site.code}".`,
    );
  }

  return {
    email: user.email,
    fullName: user.fullName,
    sessionId: 'english-speaking-reference-import',
    siteId: user.siteId,
    status: user.status,
    userId: user.id,
    userType: user.userType,
  };
}

async function loadReferenceDocument(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ReferenceDocument>;

  if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
    throw new Error(
      `Reference file ${filePath} does not contain a data array.`,
    );
  }

  return {
    data: parsed.data.map((item, index) => ({
      english: requireSentenceField(item, 'english', filePath, index),
      hindi: requireSentenceField(item, 'hindi', filePath, index),
      marathi: requireSentenceField(item, 'marathi', filePath, index),
    })),
    document_title:
      typeof parsed.document_title === 'string'
        ? parsed.document_title
        : undefined,
  };
}

function requireSentenceField(
  item: unknown,
  field: 'english' | 'hindi' | 'marathi',
  filePath: string,
  index: number,
) {
  const value =
    typeof item === 'object' && item !== null
      ? (item as Record<string, unknown>)[field]
      : undefined;

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Reference file ${filePath} is missing ${field} for sentence ${index + 1}.`,
    );
  }

  return value;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
