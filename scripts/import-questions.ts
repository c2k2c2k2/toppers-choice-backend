import { readFile, readdir } from 'node:fs/promises';
import { extname, isAbsolute, resolve } from 'node:path';
import { ConflictException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus, UserType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { type AuthenticatedUser } from '../src/modules/auth/auth.types';
import { QuestionsService } from '../src/modules/questions/questions.service';
import { CreateQuestionDto } from '../src/modules/questions/dto/manage-questions.dto';

type ImportMode = 'service' | 'api';

type RawQuestionFile = {
  questions?: unknown;
};

type NormalizedQuestionPayload = {
  sourcePath: string;
  questionNumber: number;
  dto: CreateQuestionDto;
};

type ImportOptions = {
  inputPath: string;
  examTrack: string;
  subject: string;
  topic?: string;
  medium?: string;
  siteId?: string;
  siteSlug?: string;
  mode: ImportMode;
  adminEmail?: string;
  userId?: string;
  apiBaseUrl?: string;
  accessToken?: string;
  publish: boolean;
  dryRun: boolean;
  skipCodeConflicts: boolean;
  limit?: number;
};

type ImportSummary = {
  created: number;
  published: number;
  skipped: number;
};

type QuestionLanguageMode = 'ENGLISH' | 'MARATHI' | 'BILINGUAL';

const HELP_TEXT = `
Import question files into Toppers' Choice.

Usage:
  pnpm questions:import --input <file-or-directory> --exam-track <value> --subject <value> [options]

Required:
  --input <path>               File or directory containing .txt/.json question files
  --exam-track <value>         Exam track id/code/slug/name
  --subject <value>            Subject id/code/slug/name

Optional taxonomy mapping:
  --topic <value>              Topic id/code/slug/name to apply to imported questions
  --medium <value>             Medium id/code/slug/name to apply to imported questions
  --site-id <value>            Restrict lookup to one site id
  --site-slug <value>          Restrict lookup to one site slug

Import mode:
  --mode <service|api>         Default: service
  --admin-email <value>        Required for service mode unless --user-id is used
  --user-id <value>            Required for service mode unless --admin-email is used
  --api-base-url <value>       Required for api mode, e.g. http://localhost:3000
  --access-token <value>       Required for api mode

Behavior:
  --publish                    Publish each question after creation
  --dry-run                    Validate, resolve taxonomy, and print summary without writing
  --skip-code-conflicts        Skip duplicate question-code conflicts instead of stopping
  --limit <number>             Import only the first N questions after file merge
  --help                       Show this message

Examples:
  pnpm questions:import --input "/Users/me/questions" --exam-track "एमपीएससी व तत्सम स्पर्धा परीक्षा" --subject "सामान्यज्ञान" --topic "महाराष्ट्र" --medium mr --admin-email "admin@example.com"
  pnpm questions:import --input ./data/questions --exam-track mpsc-marathi-allied --subject general-knowledge --topic maharashtra --medium mr --mode api --api-base-url http://localhost:3000 --access-token <token> --publish
`.trim();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    return;
  }

  const prisma = new PrismaService({
    get: (key: string) => process.env[key],
  } as ConfigService);

  await prisma.$connect();

  try {
    const resolvedSiteId = await resolveSiteId(prisma, options);
    const track = await resolveExamTrack(
      prisma,
      options.examTrack,
      resolvedSiteId,
    );
    const subject = await resolveSubject(
      prisma,
      track.siteId,
      track.id,
      options.subject,
    );
    const topic = options.topic
      ? await resolveTopic(prisma, track.siteId, subject.id, options.topic)
      : null;
    const medium = options.medium
      ? await resolveMedium(prisma, track.siteId, options.medium)
      : null;

    const files = await collectQuestionFiles(
      resolveInputPath(options.inputPath),
    );
    if (files.length === 0) {
      throw new Error(
        'No .txt or .json files were found in the provided input path.',
      );
    }

    const normalized = await normalizeQuestionFiles({
      files,
      subjectId: subject.id,
      topicId: topic?.id,
      mediumId: medium?.id,
      limit: options.limit,
    });

    const actor =
      options.mode === 'service' && !options.dryRun
        ? await resolveActor(prisma, track.siteId, options)
        : null;

    printImportPlan({
      options,
      files,
      questionCount: normalized.length,
      track,
      subject,
      topic,
      medium,
      actor,
    });

    if (options.dryRun) {
      console.log('Dry run complete. No questions were created.');
      return;
    }

    const summary =
      options.mode === 'service'
        ? await importThroughService({
            prisma,
            actor: actor!,
            questions: normalized,
            publish: options.publish,
            skipCodeConflicts: options.skipCodeConflicts,
          })
        : await importThroughApi({
            questions: normalized,
            baseUrl: options.apiBaseUrl!,
            accessToken: options.accessToken!,
            publish: options.publish,
            skipCodeConflicts: options.skipCodeConflicts,
          });

    console.log(
      `Import complete. Created: ${summary.created}, published: ${summary.published}, skipped: ${summary.skipped}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): ImportOptions | null {
  if (argv.includes('--help')) {
    console.log(HELP_TEXT);
    return null;
  }

  const valueByFlag = new Map<string, string>();
  const booleanFlags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}". Use --help for usage.`);
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      booleanFlags.add(token);
      continue;
    }

    valueByFlag.set(token, next);
    index += 1;
  }

  const inputPath = valueByFlag.get('--input');
  const examTrack = valueByFlag.get('--exam-track');
  const subject = valueByFlag.get('--subject');

  if (!inputPath || !examTrack || !subject) {
    throw new Error(
      'Missing required arguments. --input, --exam-track, and --subject are required.',
    );
  }

  const modeValue = (valueByFlag.get('--mode') ?? 'service').toLowerCase();
  if (modeValue !== 'service' && modeValue !== 'api') {
    throw new Error(`Unsupported mode "${modeValue}". Use "service" or "api".`);
  }

  const options: ImportOptions = {
    inputPath,
    examTrack,
    subject,
    topic: valueByFlag.get('--topic'),
    medium: valueByFlag.get('--medium'),
    siteId: valueByFlag.get('--site-id'),
    siteSlug: valueByFlag.get('--site-slug'),
    mode: modeValue,
    adminEmail: valueByFlag.get('--admin-email'),
    userId: valueByFlag.get('--user-id'),
    apiBaseUrl: valueByFlag.get('--api-base-url'),
    accessToken: valueByFlag.get('--access-token'),
    publish: booleanFlags.has('--publish'),
    dryRun: booleanFlags.has('--dry-run'),
    skipCodeConflicts: booleanFlags.has('--skip-code-conflicts'),
    limit: parseOptionalLimit(valueByFlag.get('--limit')),
  };

  if (options.mode === 'service' && !options.dryRun) {
    if (!options.adminEmail && !options.userId) {
      throw new Error(
        'Service mode requires --admin-email or --user-id unless you are using --dry-run.',
      );
    }
  }

  if (options.mode === 'api' && !options.dryRun) {
    if (!options.apiBaseUrl || !options.accessToken) {
      throw new Error(
        'API mode requires both --api-base-url and --access-token unless you are using --dry-run.',
      );
    }
  }

  return options;
}

function parseOptionalLimit(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid --limit value "${value}". It must be a positive integer.`,
    );
  }

  return parsed;
}

function resolveInputPath(inputPath: string) {
  return isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);
}

async function resolveSiteId(prisma: PrismaService, options: ImportOptions) {
  if (options.siteId) {
    return options.siteId;
  }

  if (!options.siteSlug) {
    return undefined;
  }

  const site = await prisma.site.findUnique({
    where: {
      slug: options.siteSlug,
    },
    select: {
      id: true,
    },
  });

  if (!site) {
    throw new Error(`Site with slug "${options.siteSlug}" was not found.`);
  }

  return site.id;
}

async function collectQuestionFiles(inputPath: string): Promise<string[]> {
  const stats = await readdirOrFile(inputPath);
  if (stats.kind === 'file') {
    validateSupportedFile(inputPath);
    return [inputPath];
  }

  const files: string[] = [];
  for (const entry of stats.entries) {
    if (entry.isDirectory()) {
      files.push(
        ...(await collectQuestionFiles(resolve(inputPath, entry.name))),
      );
      continue;
    }

    const filePath = resolve(inputPath, entry.name);
    if (isSupportedQuestionFile(filePath)) {
      files.push(filePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function readdirOrFile(inputPath: string) {
  try {
    const entries = await readdir(inputPath, { withFileTypes: true });
    return {
      kind: 'directory' as const,
      entries,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOTDIR') {
      return {
        kind: 'file' as const,
      };
    }

    throw error;
  }
}

function isSupportedQuestionFile(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  return extension === '.json' || extension === '.txt';
}

function validateSupportedFile(filePath: string) {
  if (!isSupportedQuestionFile(filePath)) {
    throw new Error(
      `Unsupported input file "${filePath}". Only .json and .txt files are supported.`,
    );
  }
}

async function normalizeQuestionFiles(input: {
  files: string[];
  subjectId: string;
  topicId?: string;
  mediumId?: string;
  limit?: number;
}): Promise<NormalizedQuestionPayload[]> {
  const normalized: NormalizedQuestionPayload[] = [];

  for (const filePath of input.files) {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(stripBom(raw)) as RawQuestionFile | unknown[];
    const questions = extractQuestionsArray(parsed, filePath);

    questions.forEach((question, index) => {
      const merged = {
        ...(question as Record<string, unknown>),
        subjectId: input.subjectId,
        topicId:
          input.topicId ??
          ((question as Record<string, unknown>).topicId as string | undefined),
        mediumId:
          input.mediumId ??
          ((question as Record<string, unknown>).mediumId as
            | string
            | undefined),
        metadataJson: mergeQuestionMetadata(
          (question as Record<string, unknown>).metadataJson,
          inferQuestionLanguageMode(question),
        ),
      };

      const dto = plainToInstance(CreateQuestionDto, merged);
      const errors = validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: false,
        stopAtFirstError: false,
        validationError: {
          target: false,
        },
      });

      if (errors.length > 0) {
        throw new Error(
          [
            `Validation failed for ${filePath} question #${index + 1}.`,
            ...flattenValidationErrors(errors),
          ].join('\n'),
        );
      }

      normalized.push({
        sourcePath: filePath,
        questionNumber: index + 1,
        dto,
      });
    });
  }

  return input.limit ? normalized.slice(0, input.limit) : normalized;
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function extractQuestionsArray(
  parsed: RawQuestionFile | unknown[],
  filePath: string,
) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.questions)) {
    return parsed.questions;
  }

  throw new Error(
    `File "${filePath}" must contain either an array or an object with a questions array.`,
  );
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath?: string,
): string[] {
  return errors.flatMap((error) => {
    const currentPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const currentMessages = error.constraints
      ? Object.values(error.constraints).map(
          (message) => `- ${currentPath}: ${message}`,
        )
      : [];

    const childMessages = error.children?.length
      ? flattenValidationErrors(error.children, currentPath)
      : [];

    return [...currentMessages, ...childMessages];
  });
}

function mergeQuestionMetadata(
  value: unknown,
  languageMode: QuestionLanguageMode,
) {
  const nextValue = isRecord(value) ? { ...value } : {};
  if (typeof nextValue.languageMode !== 'string') {
    nextValue.languageMode = languageMode;
  }

  return nextValue;
}

function inferQuestionLanguageMode(question: unknown): QuestionLanguageMode {
  const record = isRecord(question) ? question : {};
  const statementJson = record.statementJson;
  const explanationJson = record.explanationJson;
  const options = Array.isArray(record.options) ? record.options : [];

  const hasEnglish = hasLocalizedQuestionContent(statementJson, 'en');
  const hasMarathi =
    hasLocalizedQuestionContent(statementJson, 'mr') ||
    options.some(
      (option) =>
        isRecord(option) &&
        hasLocalizedQuestionContent(option.contentJson, 'mr'),
    ) ||
    hasLocalizedQuestionContent(explanationJson, 'mr');

  if (hasEnglish && hasMarathi) {
    return 'BILINGUAL';
  }

  if (hasMarathi) {
    return 'MARATHI';
  }

  return 'ENGLISH';
}

function hasLocalizedQuestionContent(value: unknown, locale: 'en' | 'mr') {
  return hasMeaningfulQuestionContent(getQuestionLocalizedValue(value, locale));
}

function getQuestionLocalizedValue(
  value: unknown,
  locale: 'en' | 'mr',
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const localeKeys = locale === 'en' ? ['en-IN', 'en'] : ['mr-IN', 'mr'];
  for (const localeKey of localeKeys) {
    if (value[localeKey] !== undefined) {
      return value[localeKey];
    }
  }

  if (isRecord(value.translations)) {
    for (const localeKey of localeKeys) {
      if (value.translations[localeKey] !== undefined) {
        return value.translations[localeKey];
      }
    }
  }

  return isStructuredQuestionContentNode(value) ? value : undefined;
}

function hasMeaningfulQuestionContent(value: unknown): boolean {
  return extractQuestionContentText(value).length > 0;
}

function extractQuestionContentText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => extractQuestionContentText(entry))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  if (!isRecord(value)) {
    return '';
  }

  if (isStructuredQuestionContentNode(value)) {
    const fragments: string[] = [];

    if (typeof value.html === 'string' && value.html.trim()) {
      fragments.push(value.html.replace(/<[^>]+>/gu, ' ').trim());
    }

    ['text', 'contentHtml', 'content', 'body'].forEach((key) => {
      const entry = value[key];
      if (typeof entry === 'string' && entry.trim()) {
        fragments.push(
          key.toLowerCase().includes('html')
            ? entry.replace(/<[^>]+>/gu, ' ').trim()
            : entry.trim(),
        );
      }
    });

    if (Array.isArray(value.blocks)) {
      value.blocks.forEach((block) => {
        const blockText = extractQuestionContentText(block);
        if (blockText) {
          fragments.push(blockText);
        }
      });
    }

    return fragments.join(' ').replace(/\s+/gu, ' ').trim();
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStructuredQuestionContentNode(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    (Array.isArray(value.blocks) ||
      typeof value.html === 'string' ||
      typeof value.text === 'string' ||
      typeof value.contentHtml === 'string' ||
      typeof value.content === 'string' ||
      typeof value.body === 'string')
  );
}

async function resolveExamTrack(
  prisma: PrismaService,
  selector: string,
  siteId?: string,
) {
  return resolveSingleEntity(
    prisma.examTrack.findMany({
      where: {
        siteId,
        OR: buildIdentityFilter(selector),
      },
      select: {
        id: true,
        siteId: true,
        code: true,
        slug: true,
        name: true,
      },
    }),
    `exam track "${selector}"`,
  );
}

async function resolveSubject(
  prisma: PrismaService,
  siteId: string,
  examTrackId: string,
  selector: string,
) {
  return resolveSingleEntity(
    prisma.subject.findMany({
      where: {
        siteId,
        examTrackId,
        OR: buildIdentityFilter(selector),
      },
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
      },
    }),
    `subject "${selector}" under the selected exam track`,
  );
}

async function resolveTopic(
  prisma: PrismaService,
  siteId: string,
  subjectId: string,
  selector: string,
) {
  return resolveSingleEntity(
    prisma.topic.findMany({
      where: {
        siteId,
        subjectId,
        OR: buildIdentityFilter(selector),
      },
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
      },
    }),
    `topic "${selector}" under the selected subject`,
  );
}

async function resolveMedium(
  prisma: PrismaService,
  siteId: string,
  selector: string,
) {
  return resolveSingleEntity(
    prisma.medium.findMany({
      where: {
        siteId,
        OR: buildIdentityFilter(selector),
      },
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
      },
    }),
    `medium "${selector}"`,
  );
}

function buildIdentityFilter(selector: string) {
  return [
    { id: selector },
    { code: selector },
    { slug: selector },
    { name: selector },
  ];
}

async function resolveSingleEntity<
  T extends { id: string; code: string; slug: string; name: string },
>(promise: Promise<T[]>, label: string) {
  const matches = await promise;

  if (matches.length === 0) {
    throw new Error(`Could not resolve ${label}.`);
  }

  if (matches.length > 1) {
    const descriptions = matches.map(
      (item) => `${item.id} (${item.code} / ${item.slug} / ${item.name})`,
    );
    throw new Error(
      `Multiple matches were found for ${label}:\n- ${descriptions.join('\n- ')}`,
    );
  }

  return matches[0];
}

async function resolveActor(
  prisma: PrismaService,
  siteId: string,
  options: ImportOptions,
): Promise<AuthenticatedUser> {
  const user = await prisma.user.findFirst({
    where: {
      siteId,
      ...(options.userId ? { id: options.userId } : {}),
      ...(options.adminEmail ? { email: options.adminEmail } : {}),
    },
    select: {
      id: true,
      siteId: true,
      email: true,
      fullName: true,
      userType: true,
      status: true,
    },
  });

  if (!user) {
    throw new Error('Import actor was not found for the selected site.');
  }

  if (user.userType !== UserType.ADMIN) {
    throw new Error(`User "${user.email}" is not an admin user.`);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new Error(`User "${user.email}" is not active.`);
  }

  return {
    userId: user.id,
    siteId: user.siteId,
    sessionId: 'question-import-script',
    email: user.email,
    fullName: user.fullName,
    userType: user.userType,
    status: user.status,
  };
}

function printImportPlan(input: {
  options: ImportOptions;
  files: string[];
  questionCount: number;
  track: { id: string; code: string; name: string; siteId: string };
  subject: { id: string; code: string; name: string };
  topic: { id: string; code: string; name: string } | null;
  medium: { id: string; code: string; name: string } | null;
  actor: AuthenticatedUser | null;
}) {
  console.log(`Mode: ${input.options.mode}`);
  console.log(`Dry run: ${input.options.dryRun ? 'yes' : 'no'}`);
  console.log(`Files discovered: ${input.files.length}`);
  console.log(`Questions prepared: ${input.questionCount}`);
  console.log(
    `Exam track: ${input.track.name} (${input.track.code}) -> ${input.track.id}`,
  );
  console.log(
    `Subject: ${input.subject.name} (${input.subject.code}) -> ${input.subject.id}`,
  );
  console.log(
    `Topic: ${
      input.topic
        ? `${input.topic.name} (${input.topic.code}) -> ${input.topic.id}`
        : 'not set'
    }`,
  );
  console.log(
    `Medium: ${
      input.medium
        ? `${input.medium.name} (${input.medium.code}) -> ${input.medium.id}`
        : 'not set'
    }`,
  );

  if (input.actor) {
    console.log(`Actor: ${input.actor.email} -> ${input.actor.userId}`);
  }
}

async function importThroughService(input: {
  prisma: PrismaService;
  actor: AuthenticatedUser;
  questions: NormalizedQuestionPayload[];
  publish: boolean;
  skipCodeConflicts: boolean;
}): Promise<ImportSummary> {
  const questionsService = new QuestionsService(input.prisma);
  const summary: ImportSummary = {
    created: 0,
    published: 0,
    skipped: 0,
  };

  for (const payload of input.questions) {
    try {
      const created = await questionsService.createQuestion(
        input.actor,
        payload.dto,
      );
      summary.created += 1;

      if (input.publish) {
        await questionsService.publishQuestion(input.actor, created.id);
        summary.published += 1;
      }

      console.log(
        `Imported ${payload.dto.code ?? '(no-code)'} from ${payload.sourcePath} question #${payload.questionNumber}.`,
      );
    } catch (error) {
      if (input.skipCodeConflicts && isQuestionCodeConflict(error)) {
        summary.skipped += 1;
        console.warn(
          `Skipped duplicate code ${payload.dto.code ?? '(no-code)'} from ${payload.sourcePath} question #${payload.questionNumber}.`,
        );
        continue;
      }

      throw decorateImportError(error, payload);
    }
  }

  return summary;
}

async function importThroughApi(input: {
  questions: NormalizedQuestionPayload[];
  baseUrl: string;
  accessToken: string;
  publish: boolean;
  skipCodeConflicts: boolean;
}): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    published: 0,
    skipped: 0,
  };

  const normalizedBaseUrl = input.baseUrl.replace(/\/+$/u, '');
  const authHeader = normalizeAuthorizationHeader(input.accessToken);

  for (const payload of input.questions) {
    const createResponse = await fetch(`${normalizedBaseUrl}/admin/questions`, {
      method: 'POST',
      headers: {
        authorization: authHeader,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload.dto),
    });

    const createBody = await parseJsonResponse(createResponse);

    if (!createResponse.ok) {
      if (
        input.skipCodeConflicts &&
        isQuestionCodeConflictResponse(createResponse.status, createBody)
      ) {
        summary.skipped += 1;
        console.warn(
          `Skipped duplicate code ${payload.dto.code ?? '(no-code)'} from ${payload.sourcePath} question #${payload.questionNumber}.`,
        );
        continue;
      }

      throw decorateImportError(
        new Error(
          `API import failed with status ${createResponse.status}: ${stringifyUnknown(
            createBody,
          )}`,
        ),
        payload,
      );
    }

    summary.created += 1;

    if (input.publish) {
      const createdId =
        createBody && typeof createBody === 'object' && 'id' in createBody
          ? String(createBody.id)
          : null;

      if (!createdId) {
        throw decorateImportError(
          new Error(
            'Create response did not include a question id for publish.',
          ),
          payload,
        );
      }

      const publishResponse = await fetch(
        `${normalizedBaseUrl}/admin/questions/${createdId}/publish`,
        {
          method: 'POST',
          headers: {
            authorization: authHeader,
            'content-type': 'application/json',
          },
        },
      );

      const publishBody = await parseJsonResponse(publishResponse);
      if (!publishResponse.ok) {
        throw decorateImportError(
          new Error(
            `Publish failed with status ${publishResponse.status}: ${stringifyUnknown(
              publishBody,
            )}`,
          ),
          payload,
        );
      }

      summary.published += 1;
    }

    console.log(
      `Imported ${payload.dto.code ?? '(no-code)'} from ${payload.sourcePath} question #${payload.questionNumber}.`,
    );
  }

  return summary;
}

function normalizeAuthorizationHeader(accessToken: string) {
  return /^bearer\s+/iu.test(accessToken)
    ? accessToken
    : `Bearer ${accessToken}`;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isQuestionCodeConflict(error: unknown) {
  if (!(error instanceof ConflictException)) {
    return false;
  }

  const response = error.getResponse();
  return (
    Boolean(response) &&
    typeof response === 'object' &&
    'code' in response &&
    response.code === 'QUESTION_CODE_CONFLICT'
  );
}

function isQuestionCodeConflictResponse(status: number, body: unknown) {
  const responseBody =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : null;

  return status === 409 && responseBody?.code === 'QUESTION_CODE_CONFLICT';
}

function decorateImportError(
  error: unknown,
  payload: NormalizedQuestionPayload,
) {
  const details =
    error instanceof HttpException
      ? stringifyUnknown(error.getResponse())
      : error instanceof Error
        ? error.message
        : stringifyUnknown(error);

  return new Error(
    `Import failed for ${payload.sourcePath} question #${payload.questionNumber} (${payload.dto.code ?? 'no-code'}): ${details}`,
  );
}

function stringifyUnknown(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
