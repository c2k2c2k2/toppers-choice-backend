import { ConfigStatus, PrismaClient } from '@prisma/client';

const ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY = 'englishSpeaking.runtime';
const TARGET_MODEL_ID = 'eleven_v3';

type RuntimeConfigJson = {
  tts?: {
    modelId?: string;
    outputFormat?: string;
    voiceIds?: {
      default?: string;
      english?: string;
      hindi?: string;
      marathi?: string;
    };
    voiceSettings?: {
      similarityBoost?: number;
      speed?: number;
      stability?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    };
  };
};

async function main() {
  const prisma = new PrismaClient();

  try {
    const activeSites = await prisma.site.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        code: true,
        id: true,
        name: true,
      },
    });

    if (activeSites.length === 0) {
      throw new Error('No active sites were found.');
    }

    for (const site of activeSites) {
      const publishedConfigs = await prisma.siteConfigVersion.findMany({
        where: {
          siteId: site.id,
          configKey: ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
          status: ConfigStatus.PUBLISHED,
        },
        orderBy: {
          version: 'desc',
        },
        take: 1,
        select: {
          configJson: true,
          version: true,
          visibility: true,
        },
      });

      const currentConfig = publishedConfigs[0];

      if (!currentConfig) {
        console.log(
          `Skipping ${site.code}: no published ${ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY} config exists yet.`,
        );
        continue;
      }

      const configJson = (currentConfig.configJson ?? {}) as RuntimeConfigJson;
      const currentModelId = configJson.tts?.modelId ?? null;

      if (currentModelId === TARGET_MODEL_ID) {
        console.log(`Skipping ${site.code}: already using ${TARGET_MODEL_ID}.`);
        continue;
      }

      const nextConfig: RuntimeConfigJson = {
        ...configJson,
        tts: {
          ...configJson.tts,
          modelId: TARGET_MODEL_ID,
        },
      };

      await prisma.siteConfigVersion.create({
        data: {
          siteId: site.id,
          configKey: ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
          version: currentConfig.version + 1,
          status: ConfigStatus.PUBLISHED,
          visibility: currentConfig.visibility,
          configJson: nextConfig,
          publishedAt: new Date(),
        },
      });

      console.log(
        `Updated ${site.code} (${site.name}) from ${currentModelId ?? 'unset'} to ${TARGET_MODEL_ID} at version ${currentConfig.version + 1}.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
