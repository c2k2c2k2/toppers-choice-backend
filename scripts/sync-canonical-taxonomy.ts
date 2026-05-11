import { PrismaClient } from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';
import { syncCanonicalTaxonomy } from '../prisma/seed-taxonomy';

type SyncOptions = {
  siteCode: string;
};

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const site = await prisma.site.findUnique({
      where: { code: options.siteCode },
      select: { id: true, code: true, name: true },
    });
    if (!site) {
      throw new Error(`Site "${options.siteCode}" was not found.`);
    }

    const summary = await syncCanonicalTaxonomy(prisma, site.id);
    console.log(
      JSON.stringify(
        {
          site: site.code,
          createdExamTracks: summary.createdExamTracks,
          createdMediums: summary.createdMediums,
          createdSubjects: summary.createdSubjects,
          createdTopics: summary.createdTopics,
          deactivatedSubjects: summary.deactivatedSubjects,
          deactivatedTopics: summary.deactivatedTopics,
          updatedExamTracks: summary.updatedExamTracks,
          updatedMediums: summary.updatedMediums,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): SyncOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}".`);
    }

    const [flag, inlineValue] = token.split('=', 2);
    const next = inlineValue ?? argv[index + 1];
    if (!next || (!inlineValue && next.startsWith('--'))) {
      throw new Error(`Missing value for ${flag}.`);
    }

    values.set(flag, next);
    if (!inlineValue) {
      index += 1;
    }
  }

  return {
    siteCode: values.get('--site-code')?.trim() || 'toppers-choice',
  };
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
