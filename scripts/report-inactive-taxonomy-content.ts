import { PrismaClient } from '@prisma/client';

type LegacyNoteRecord = {
  id: string;
  title: string;
  subjectCode: string;
  mediumCode: string | null;
  topicCodes: string[];
};

type LegacyQuestionRecord = {
  id: string;
  code: string | null;
  subjectCode: string;
  mediumCode: string | null;
  topicCode: string | null;
  promptPreview: string | null;
};

async function main() {
  const prisma = new PrismaClient();

  try {
    const site = await prisma.site.findFirst({
      where: { slug: 'toppers-choice' },
      select: { id: true, code: true },
    });

    if (!site) {
      throw new Error('Default site "toppers-choice" was not found.');
    }

    const [inactiveSubjects, inactiveTopics, legacyNotes, legacyQuestions] =
      await Promise.all([
        prisma.subject.findMany({
          where: {
            siteId: site.id,
            isActive: false,
          },
          orderBy: [{ examTrack: { code: 'asc' } }, { code: 'asc' }],
          select: {
            id: true,
            code: true,
            name: true,
            examTrack: {
              select: {
                code: true,
                isActive: true,
              },
            },
          },
        }),
        prisma.topic.findMany({
          where: {
            siteId: site.id,
            isActive: false,
          },
          orderBy: [{ subject: { code: 'asc' } }, { code: 'asc' }],
          select: {
            id: true,
            code: true,
            name: true,
            parentId: true,
            subject: {
              select: {
                code: true,
                examTrack: {
                  select: {
                    code: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        }),
        prisma.note.findMany({
          where: {
            siteId: site.id,
            subject: {
              isActive: false,
            },
          },
          orderBy: [{ subject: { code: 'asc' } }, { title: 'asc' }],
          select: {
            id: true,
            title: true,
            medium: {
              select: {
                code: true,
              },
            },
            subject: {
              select: {
                code: true,
              },
            },
            noteTopics: {
              orderBy: [{ topic: { code: 'asc' } }],
              select: {
                topic: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        }),
        prisma.question.findMany({
          where: {
            siteId: site.id,
            subject: {
              isActive: false,
            },
          },
          orderBy: [{ subject: { code: 'asc' } }, { createdAt: 'asc' }],
          select: {
            id: true,
            code: true,
            medium: {
              select: {
                code: true,
              },
            },
            subject: {
              select: {
                code: true,
              },
            },
            topic: {
              select: {
                code: true,
              },
            },
            statementJson: true,
          },
        }),
      ]);

    const normalizedNotes: LegacyNoteRecord[] = legacyNotes.map((note) => ({
      id: note.id,
      title: note.title,
      subjectCode: note.subject.code,
      mediumCode: note.medium?.code ?? null,
      topicCodes: note.noteTopics.map((item) => item.topic.code),
    }));

    const normalizedQuestions: LegacyQuestionRecord[] = legacyQuestions.map(
      (question) => ({
        id: question.id,
        code: question.code,
        subjectCode: question.subject.code,
        mediumCode: question.medium?.code ?? null,
        topicCode: question.topic?.code ?? null,
        promptPreview: extractPromptPreview(question.statementJson),
      }),
    );

    const summary = {
      site: site.code,
      inactiveSubjectCount: inactiveSubjects.length,
      inactiveTopicCount: inactiveTopics.length,
      notesOnInactiveSubjects: normalizedNotes.length,
      questionsOnInactiveSubjects: normalizedQuestions.length,
    };

    console.log(
      JSON.stringify(
        {
          summary,
          inactiveSubjects,
          inactiveTopics,
          legacyNotes: normalizedNotes,
          legacyQuestions: normalizedQuestions,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

function extractPromptPreview(statementJson: unknown) {
  if (!statementJson || typeof statementJson !== 'object') {
    return null;
  }

  const locales = Object.values(statementJson as Record<string, unknown>);
  for (const locale of locales) {
    if (!locale || typeof locale !== 'object') {
      continue;
    }

    const blocks = (locale as { blocks?: unknown }).blocks;
    if (!Array.isArray(blocks)) {
      continue;
    }

    for (const block of blocks) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      const textValue =
        'text' in block && typeof block.text === 'string'
          ? block.text
          : 'html' in block && typeof block.html === 'string'
            ? block.html.replace(/<[^>]+>/g, ' ')
            : null;
      if (!textValue) {
        continue;
      }

      const compact = textValue.replace(/\s+/g, ' ').trim();
      if (compact.length > 0) {
        return compact.slice(0, 140);
      }
    }
  }

  return null;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
