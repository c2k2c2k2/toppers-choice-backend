import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

type TopicEntryMode = 'FULL' | 'SUBJECT_ONLY' | 'DEFERRED';

type TopicDraft = {
  code: string;
  slug: string;
  name: string;
  englishName?: string | null;
  nativeName?: string | null;
  topics: TopicDraft[];
};

type SubjectDraft = {
  code: string;
  slug: string;
  name: string;
  englishName?: string | null;
  nativeName?: string | null;
  topicEntryMode: TopicEntryMode;
  entryNotes?: string[];
  topics: TopicDraft[];
};

type MediumDraft = {
  code: string;
  slug: string;
  name: string;
};

type ExamTrackDraft = {
  code: string;
  slug: string;
  name: string;
  shortName?: string | null;
  englishName?: string | null;
  nativeName?: string | null;
  defaultMediumCode: string;
  subjects: SubjectDraft[];
};

type TaxonomyDraft = {
  version: string;
  modelDecision: string;
  mediums: MediumDraft[];
  examTracks: ExamTrackDraft[];
};

const DEFAULT_FILE = resolve(
  process.cwd(),
  'references',
  'client requirements',
  'mpsc-taxonomy-canonical-draft.json',
);

async function main() {
  const filePath = resolveDraftPath(process.argv.slice(2));
  const payload = await loadDraft(filePath);

  const errors: string[] = [];
  const warnings: string[] = [];

  validateUniqueKeys(
    payload.mediums.map((medium) => medium.code),
    'medium code',
    errors,
  );
  validateUniqueKeys(
    payload.mediums.map((medium) => medium.slug),
    'medium slug',
    errors,
  );
  validateUniqueKeys(
    payload.examTracks.map((track) => track.code),
    'exam track code',
    errors,
  );
  validateUniqueKeys(
    payload.examTracks.map((track) => track.slug),
    'exam track slug',
    errors,
  );

  const mediumCodes = new Set(payload.mediums.map((medium) => medium.code));

  let totalSubjects = 0;
  let totalTopics = 0;

  for (const track of payload.examTracks) {
    totalSubjects += track.subjects.length;

    if (!mediumCodes.has(track.defaultMediumCode)) {
      errors.push(
        `Track "${track.code}" points to missing defaultMediumCode "${track.defaultMediumCode}".`,
      );
    }

    validateUniqueKeys(
      track.subjects.map((subject) => subject.code),
      `subject code in track "${track.code}"`,
      errors,
    );
    validateUniqueKeys(
      track.subjects.map((subject) => subject.slug),
      `subject slug in track "${track.code}"`,
      errors,
    );

    for (const subject of track.subjects) {
      const flattenedTopics = flattenTopics(subject.topics);
      totalTopics += flattenedTopics.length;

      validateUniqueKeys(
        flattenedTopics.map((topic) => topic.code),
        `topic code in track "${track.code}" subject "${subject.code}"`,
        errors,
      );
      validateUniqueKeys(
        flattenedTopics.map((topic) => topic.slug),
        `topic slug in track "${track.code}" subject "${subject.code}"`,
        errors,
      );

      if (subject.topicEntryMode === 'FULL' && flattenedTopics.length === 0) {
        errors.push(
          `Subject "${track.code}/${subject.code}" is marked FULL but has no topics.`,
        );
      }

      if (
        (subject.topicEntryMode === 'SUBJECT_ONLY' ||
          subject.topicEntryMode === 'DEFERRED') &&
        flattenedTopics.length > 0
      ) {
        errors.push(
          `Subject "${track.code}/${subject.code}" is marked ${subject.topicEntryMode} but still contains topics.`,
        );
      }

      if (
        subject.topicEntryMode === 'DEFERRED' &&
        (subject.entryNotes?.length ?? 0) === 0
      ) {
        warnings.push(
          `Subject "${track.code}/${subject.code}" is DEFERRED without an explanatory entry note.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Validation failed for ${filePath}.`);
    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }
    for (const warning of warnings) {
      console.warn(`WARN: ${warning}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated taxonomy draft: ${filePath}`);
  console.log(`Version: ${payload.version}`);
  console.log(`Mediums: ${payload.mediums.length}`);
  console.log(`Exam tracks: ${payload.examTracks.length}`);
  console.log(`Subjects: ${totalSubjects}`);
  console.log(`Topics: ${totalTopics}`);

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`WARN: ${warning}`);
    }
  }
}

function resolveDraftPath(argv: string[]) {
  const fileArg = argv.find((value) => !value.startsWith('--'));

  if (!fileArg) {
    return DEFAULT_FILE;
  }

  return isAbsolute(fileArg) ? fileArg : resolve(process.cwd(), fileArg);
}

async function loadDraft(filePath: string): Promise<TaxonomyDraft> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as TaxonomyDraft;
}

function flattenTopics(topics: TopicDraft[]): TopicDraft[] {
  return topics.flatMap((topic) => [topic, ...flattenTopics(topic.topics)]);
}

function validateUniqueKeys(
  values: string[],
  label: string,
  errors: string[],
) {
  const seen = new Set<string>();

  for (const value of values) {
    if (!value || !value.trim()) {
      errors.push(`Found blank ${label}.`);
      continue;
    }

    if (seen.has(value)) {
      errors.push(`Duplicate ${label}: "${value}".`);
      continue;
    }

    seen.add(value);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
