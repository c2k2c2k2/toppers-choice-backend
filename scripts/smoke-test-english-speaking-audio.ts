import { NestFactory } from '@nestjs/core';
import { UserStatus, UserType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types';
import { EnglishSpeakingService } from '../src/modules/english-speaking/english-speaking.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';

async function main() {
  const topicSlug = process.argv[2];

  if (!topicSlug) {
    throw new Error(
      'Provide a topic slug. Example: pnpm exec ts-node scripts/smoke-test-english-speaking-audio.ts airport-flight',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const englishSpeakingService = app.get(EnglishSpeakingService);
    const actor = await resolveActor(prisma);
    const topic = await prisma.englishSpeakingTopic.findFirst({
      where: {
        siteId: actor.siteId,
        slug: topicSlug,
      },
      select: {
        id: true,
        title: true,
        sentences: {
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            orderIndex: true,
            englishText: true,
          },
          take: 1,
        },
      },
    });

    if (!topic || topic.sentences.length === 0) {
      throw new Error(
        `No sentence was found for topic "${topicSlug}". Import the references first.`,
      );
    }

    const sentence = topic.sentences[0];

    console.log(
      `Generating preview audio for topic "${topic.title}" sentence ${sentence.orderIndex}: ${sentence.englishText}`,
    );

    await englishSpeakingService.generateSentenceAudio(actor, sentence.id, {});
    await englishSpeakingService.finalizeSentenceAudio(actor, sentence.id, {});

    console.log(
      `Smoke test passed. Preview and finalized audio now exist for sentence ${sentence.orderIndex} in all three languages.`,
    );
  } finally {
    await app.close();
  }
}

async function resolveActor(prisma: PrismaService): Promise<AuthenticatedUser> {
  const user = await prisma.user.findFirst({
    where: {
      userType: UserType.ADMIN,
      status: UserStatus.ACTIVE,
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
    throw new Error('No active admin user is available for the smoke test.');
  }

  return {
    email: user.email,
    fullName: user.fullName,
    sessionId: 'english-speaking-audio-smoke-test',
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
