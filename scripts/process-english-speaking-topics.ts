import { NestFactory } from '@nestjs/core';
import { ContentStatus, UserStatus, UserType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types';
import { EnglishSpeakingService } from '../src/modules/english-speaking/english-speaking.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';

type ScriptOptions = {
  adminEmail?: string;
  limit: number;
  siteCode?: string;
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

    const topics = await prisma.englishSpeakingTopic.findMany({
      where: {
        siteId: actor.siteId,
        status: {
          not: ContentStatus.PUBLISHED,
        },
      },
      orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        orderIndex: true,
        slug: true,
        title: true,
        sentences: {
          select: {
            id: true,
          },
        },
      },
      take: options.limit,
    });

    if (topics.length === 0) {
      console.log('No unpublished English speaking topics remain.');
      return;
    }

    for (const [index, topic] of topics.entries()) {
      const label = `${topic.slug} (${topic.title})`;
      const step = `${index + 1}/${topics.length}`;
      console.log(
        `[${step}] Generating preview audio for ${label} with ${topic.sentences.length} sentences...`,
      );
      await englishSpeakingService.generateTopicAudio(actor, topic.id, {});

      console.log(`[${step}] Finalizing audio for ${label}...`);
      await englishSpeakingService.finalizeTopicAudio(actor, topic.id, {});

      console.log(`[${step}] Publishing ${label}...`);
      await englishSpeakingService.publishTopic(actor, topic.id, {});

      console.log(`[${step}] Completed ${label}.`);
    }

    console.log(`Processed ${topics.length} English speaking topic(s).`);
  } finally {
    await app.close();
  }
}

function parseArgs(argv: string[]): ScriptOptions {
  let adminEmail: string | undefined;
  let siteCode: string | undefined;
  let limit = 2;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith('--')) {
      continue;
    }

    const [flag, inlineValue] = value.split('=', 2);
    const nextValue = inlineValue ?? argv[index + 1];

    switch (flag) {
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
      case '--limit':
        limit = Number.parseInt(requireValue(flag, nextValue), 10);
        if (!Number.isInteger(limit) || limit <= 0) {
          throw new Error('--limit must be a positive integer.');
        }
        if (!inlineValue) {
          index += 1;
        }
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  return {
    adminEmail,
    limit,
    siteCode,
  };
}

function requireValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

async function resolveActor(
  prisma: PrismaService,
  options: ScriptOptions,
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
      code: true,
      id: true,
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
      status: UserStatus.ACTIVE,
      userType: UserType.ADMIN,
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
    sessionId: 'english-speaking-topic-processor',
    siteId: user.siteId,
    status: user.status,
    userId: user.id,
    userType: user.userType,
  };
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
