import { execFileSync } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { Client } from 'minio';
import { PrismaClient, UserStatus, UserType } from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

type ImportOptions = {
  dryRun: boolean;
  maxPages: number;
  outputPath: string;
  requireIndexSignals: boolean;
  siteCode: string;
  skipUnparseable: boolean;
  subjectCode?: string;
  trackCode?: string;
  adminEmail?: string;
};

type ParsedIndexEntry = {
  serialLabel: string;
  title: string;
  pageNumber: number;
  indentLevel: number;
  orderIndex: number;
  titleFontHint: 'shree-dev' | null;
};

type ParsedNoteIndex = {
  noteSlug: string;
  noteTitle: string;
  subjectCode: string;
  replaceExistingIndex: boolean;
  entries: ParsedIndexEntry[];
};

type OutputFile = {
  version: 1;
  encoding: 'mixed';
  siteCode: string;
  generatedAt: string;
  notes: ParsedNoteIndex[];
};

type ParseOutcome =
  | { kind: 'parsed'; note: ParsedNoteIndex }
  | { kind: 'skipped'; reason: string };

const DEFAULT_OUTPUT_PATH =
  '/Users/raje/Documents/generated_note_indexes_from_uploaded_pdfs.json';

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const storage = createStorageClient();
    const context = await resolveContext(prisma, options);
    const subjectWhere =
      options.subjectCode || options.trackCode
        ? {
            subject: {
              ...(options.subjectCode ? { code: options.subjectCode } : {}),
              ...(options.trackCode
                ? { examTrack: { code: options.trackCode } }
                : {}),
            },
          }
        : {};
    const notes = await prisma.note.findMany({
      where: {
        siteId: context.site.id,
        status: 'PUBLISHED',
        indexEntries: { none: {} },
        ...subjectWhere,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        pageCount: true,
        medium: { select: { code: true } },
        subject: { select: { code: true } },
        fullFileAsset: {
          select: {
            objectKey: true,
            originalFileName: true,
          },
        },
      },
      orderBy: [{ subject: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
    });

    const parsedNotes: ParsedNoteIndex[] = [];
    const skippedNotes: Array<{ noteSlug: string; reason: string }> = [];
    for (const note of notes) {
      const pdfBuffer = await readObjectToBuffer(
        storage.client,
        storage.bucket,
        note.fullFileAsset.objectKey,
      );
      const parsed = await parseNoteIndexFromPdf({
        buffer: pdfBuffer,
        maxPages: options.maxPages,
        mediumCode: note.medium?.code ?? '',
        noteSlug: note.slug,
        noteTitle: note.title,
        subjectCode: note.subject.code,
        requireIndexSignals: options.requireIndexSignals,
      });
      if (parsed.kind === 'skipped') {
        skippedNotes.push({
          noteSlug: note.slug,
          reason: parsed.reason,
        });
        if (!options.skipUnparseable) {
          throw new Error(
            `Skipped "${note.slug}" because ${parsed.reason}. Re-run with --skip-unparseable to continue.`,
          );
        }
        continue;
      }

      parsedNotes.push(parsed.note);
    }

    const output: OutputFile = {
      version: 1,
      encoding: 'mixed',
      generatedAt: new Date().toISOString(),
      notes: parsedNotes,
      siteCode: context.site.code,
    };

    await writeFile(options.outputPath, JSON.stringify(output, null, 2), 'utf8');

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          site: context.site.code,
          actor: context.actor.email,
          notesProcessed: parsedNotes.length,
          notesSkipped: skippedNotes.length,
          entriesPrepared: parsedNotes.reduce(
            (total, note) => total + note.entries.length,
            0,
          ),
          outputPath: options.outputPath,
          skippedNotes,
          notes: parsedNotes.map((note) => ({
            noteSlug: note.noteSlug,
            subjectCode: note.subjectCode,
            entryCount: note.entries.length,
            titleFontHint:
              note.entries.find((entry) => entry.titleFontHint)?.titleFontHint ??
              null,
            firstEntry: note.entries[0]?.title ?? null,
          })),
        },
        null,
        2,
      ),
    );

    if (options.dryRun) {
      console.log('Dry run complete. No note index entries were written.');
      return;
    }

    let importedEntries = 0;
    for (const parsed of parsedNotes) {
      const note = notes.find((item) => item.slug === parsed.noteSlug);
      if (!note) {
        throw new Error(`Could not resolve note "${parsed.noteSlug}" for import.`);
      }

      await prisma.$transaction(async (tx) => {
        await tx.noteIndexEntry.deleteMany({
          where: { siteId: context.site.id, noteId: note.id },
        });

        await tx.noteIndexEntry.createMany({
          data: parsed.entries.map((entry) => ({
            siteId: context.site.id,
            noteId: note.id,
            serialLabel: entry.serialLabel,
            title: entry.title,
            titleFontHint: entry.titleFontHint,
            pageNumber: entry.pageNumber,
            indentLevel: entry.indentLevel,
            orderIndex: entry.orderIndex,
            createdByUserId: context.actor.id,
            updatedByUserId: context.actor.id,
          })),
        });
      });

      importedEntries += parsed.entries.length;
      console.log(`INDEXED ${parsed.noteSlug} (${parsed.entries.length} entries)`);
    }

    console.log(`Imported ${importedEntries} note index entries.`);
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): ImportOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}".`);
    }

    const [flag, inlineValue] = token.split('=', 2);
    const next = inlineValue ?? argv[index + 1];

    if (!inlineValue && (!next || next.startsWith('--'))) {
      flags.add(flag);
      continue;
    }

    values.set(flag, requireValue(flag, next));
    if (!inlineValue) {
      index += 1;
    }
  }

  const maxPages = Number(values.get('--max-pages') ?? 4);
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error('--max-pages must be a positive integer.');
  }

  return {
    adminEmail: values.get('--admin-email')?.trim().toLowerCase(),
    dryRun: flags.has('--dry-run'),
    maxPages,
    outputPath: values.get('--output')?.trim() || DEFAULT_OUTPUT_PATH,
    requireIndexSignals: flags.has('--require-index-signals'),
    siteCode: values.get('--site-code')?.trim() || 'toppers-choice',
    skipUnparseable: flags.has('--skip-unparseable'),
    subjectCode: values.get('--subject-code')?.trim() || undefined,
    trackCode: values.get('--track-code')?.trim() || undefined,
  };
}

function requireValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function createStorageClient() {
  const endpoint = requireEnv('OBJECT_STORAGE_ENDPOINT');
  const endpointUrl = new URL(endpoint);
  const bucket = requireEnv('OBJECT_STORAGE_BUCKET');
  const client = new Client({
    endPoint: endpointUrl.hostname,
    port:
      endpointUrl.port.length > 0
        ? Number(endpointUrl.port)
        : endpointUrl.protocol === 'https:'
          ? 443
          : 80,
    useSSL: endpointUrl.protocol === 'https:',
    accessKey: requireEnv('OBJECT_STORAGE_ACCESS_KEY_ID'),
    secretKey: requireEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
    region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
    pathStyle: (process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? 'true') === 'true',
  });

  return { bucket, client };
}

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable ${key}.`);
  }

  return value;
}

async function resolveContext(prisma: PrismaClient, options: ImportOptions) {
  const site = await prisma.site.findUnique({
    where: { code: options.siteCode },
    select: { id: true, code: true },
  });
  if (!site) {
    throw new Error(`Site "${options.siteCode}" was not found.`);
  }

  const actor = await prisma.user.findFirst({
    where: {
      siteId: site.id,
      userType: UserType.ADMIN,
      status: UserStatus.ACTIVE,
      ...(options.adminEmail ? { email: options.adminEmail } : {}),
    },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!actor) {
    throw new Error('No active admin actor was found for index import attribution.');
  }

  return { actor, site };
}

async function readObjectToBuffer(client: Client, bucket: string, objectKey: string) {
  const stream = await client.getObject(bucket, objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function parseNoteIndexFromPdf(input: {
  buffer: Buffer;
  maxPages: number;
  mediumCode: string;
  noteSlug: string;
  noteTitle: string;
  subjectCode: string;
  requireIndexSignals: boolean;
}): Promise<ParseOutcome> {
  const {
    buffer,
    maxPages,
    mediumCode,
    noteSlug,
    noteTitle,
    subjectCode,
    requireIndexSignals,
  } = input;
  const directory = join(tmpdir(), 'toppers-choice-note-index-extraction');
  await mkdir(directory, { recursive: true });
  const pdfPath = join(directory, basename(`${noteSlug}.pdf`));

  try {
    await writeFile(pdfPath, buffer);
    const pages = extractPdfTextPages(pdfPath, maxPages);
    if (requireIndexSignals && !pages.some((page) => pageHasIndexSignals(page))) {
      return {
        kind: 'skipped',
        reason: 'no index-like signals were found in the scanned pages',
      };
    }

    const pageOffset = noteSlug === 'vocabulary' ? 1 : 0;
    const isEnglish = mediumCode === 'en' || subjectCode === 'english';
    const entries = isEnglish
      ? parseEnglishIndexEntries(pages, pageOffset)
      : parseLegacyEncodedIndexEntries(pages, pageOffset);

    if (entries.length === 0) {
      return {
        kind: 'skipped',
        reason: 'no index entries could be parsed',
      };
    }

    return {
      kind: 'parsed',
      note: {
        entries,
        noteSlug,
        noteTitle,
        replaceExistingIndex: true,
        subjectCode,
      },
    };
  } finally {
    await safeUnlink(pdfPath);
  }
}

function extractPdfTextPages(pdfPath: string, maxPages: number) {
  const output = execFileSync(
    'python3',
    [
      '-c',
      [
        'from pypdf import PdfReader',
        'import json, sys',
        'reader = PdfReader(sys.argv[1])',
        'limit = min(int(sys.argv[2]), len(reader.pages))',
        'pages = []',
        'for index in range(limit):',
        '    text = reader.pages[index].extract_text() or ""',
        '    pages.append(text)',
        'print(json.dumps(pages, ensure_ascii=False))',
      ].join('\n'),
      pdfPath,
      String(maxPages),
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );

  return JSON.parse(output) as string[];
}

function parseLegacyEncodedIndexEntries(pages: string[], pageOffset: number) {
  const parsedEntries: ParsedIndexEntry[] = [];
  let started = false;
  let lastSerialNumber = 0;

  for (const page of pages) {
    const pageEntries: ParsedIndexEntry[] = [];
    for (const block of collectEntryBlocks(page)) {
      const normalized = normalizeWhitespace(block);
      const match =
        normalized.match(/^(\d+\))\s+(.+?)\s+(\d+)\s+Vo\s+(\d+)$/) ??
        normalized.match(/^(\d+\))\s+(.+?)\s+(\d+)$/);
      if (!match) {
        continue;
      }

      const serialLabel = match[1];
      const title = cleanupLegacyTitle(match[2]);
      const pageNumber = Number(match[3]) + pageOffset;
      if (!Number.isInteger(pageNumber) || pageNumber <= 0 || !title) {
        continue;
      }

      pageEntries.push({
        indentLevel: 0,
        orderIndex: 0,
        pageNumber,
        serialLabel,
        title,
        titleFontHint: 'shree-dev',
      });
    }

    if (pageEntries.length === 0) {
      if (started) {
        break;
      }
      continue;
    }

    const firstSerialNumber = extractSerialNumber(pageEntries[0].serialLabel);
    if (started && firstSerialNumber <= lastSerialNumber) {
      break;
    }

    started = true;
    for (const entry of pageEntries) {
      lastSerialNumber = extractSerialNumber(entry.serialLabel);
      parsedEntries.push({
        ...entry,
        orderIndex: (parsedEntries.length + 1) * 10,
      });
    }
  }

  return parsedEntries;
}

function parseEnglishIndexEntries(pages: string[], pageOffset: number) {
  const parsedEntries: ParsedIndexEntry[] = [];
  let started = false;
  let lastSerialNumber = 0;

  for (const page of pages) {
    const pageEntries: ParsedIndexEntry[] = [];
    for (const block of collectEnglishIndexBlocks(page, started)) {
      const normalized = cleanupEnglishEntryBlock(normalizeWhitespace(block));
      const match =
        normalized.match(/^(\d+[.)])\s+(.+?)\s+(\d+)(?:\s*(?:[-–]|to)\s*(\d+))?$/i) ??
        normalized.match(/^(\d+[.)])\s+(.+?)\s+(\d+)$/);
      if (!match) {
        continue;
      }

      const serialLabel = match[1];
      const title = match[2].trim();
      const pageNumber = Number(match[3]) + pageOffset;
      if (!Number.isInteger(pageNumber) || pageNumber <= 0 || !title) {
        continue;
      }

      pageEntries.push({
        indentLevel: 0,
        orderIndex: 0,
        pageNumber,
        serialLabel,
        title,
        titleFontHint: null,
      });
    }

    if (pageEntries.length === 0) {
      if (started) {
        break;
      }
      continue;
    }

    const firstSerialNumber = extractSerialNumber(pageEntries[0].serialLabel);
    if (started && firstSerialNumber <= lastSerialNumber) {
      break;
    }

    started = true;
    for (const entry of pageEntries) {
      lastSerialNumber = extractSerialNumber(entry.serialLabel);
      parsedEntries.push({
        ...entry,
        orderIndex: (parsedEntries.length + 1) * 10,
      });
    }
  }

  return parsedEntries;
}

function collectEnglishIndexBlocks(pageText: string, alreadyStarted: boolean) {
  const lines = pageText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const headerIndex = lines.findIndex((line) => isEnglishIndexHeader(line));
  if (!alreadyStarted && headerIndex === -1) {
    return [];
  }

  const relevantLines =
    headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
  const entries: string[] = [];
  let current: string | null = null;

  for (const line of relevantLines) {
    if (isEnglishIndexStop(line)) {
      break;
    }

    if (isEntryStart(line)) {
      if (current) {
        entries.push(current);
      }
      current = line;
      continue;
    }

    if (!current) {
      continue;
    }

    if (looksLikeEntryContinuation(line)) {
      current = `${current} ${line}`;
      if (isCompleteEnglishIndexEntry(current)) {
        entries.push(current);
        current = null;
      }
      continue;
    }

    if (isHeaderOrNoise(line)) {
      continue;
    }

    break;
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function collectEntryBlocks(pageText: string) {
  const lines = pageText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    if (isEntryStart(line)) {
      if (current) {
        entries.push(current);
      }
      current = line;
      continue;
    }

    if (!current) {
      continue;
    }

    if (isCompleteEntryBlock(current)) {
      entries.push(current);
      current = null;
      continue;
    }

    if (looksLikeEntryContinuation(line)) {
      current = `${current} ${line}`;
      continue;
    }

    if (isHeaderOrNoise(line)) {
      continue;
    }

    entries.push(current);
    current = null;
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function isEntryStart(line: string) {
  return /^\d+[.)]\s+/.test(line);
}

function looksLikeEntryContinuation(line: string) {
  if (isEntryStart(line)) {
    return false;
  }

  if (isHeaderOrNoise(line)) {
    return false;
  }

  return true;
}

function isHeaderOrNoise(line: string) {
  return (
    /^(?:\(\d+\)|-:|:-|Vocabulary|INDEX|Sr\s*\.?\s*No\.?|Topics|Page No\.?)$/i.test(
      line,
    ) ||
    /^(?:A\.H«\$\.|A\.H«\$.|‘wÔo|n¥ð>|क्र\.|अ\.क्र\.)/i.test(line) ||
    /^[():\-–—]+$/.test(line)
  );
}

function isCompleteEntryBlock(value: string) {
  return /^\d+[.)]\s+.+?\s+\d+(?:\s*(?:Vo|[-–])\s*\d+)?$/i.test(
    normalizeWhitespace(value),
  );
}

function isCompleteEnglishIndexEntry(value: string) {
  return /^\d+[.)]\s+.+?\s+\d+(?:\s*(?:[-–]|to)\s*\d+)?$/i.test(
    cleanupEnglishEntryBlock(normalizeWhitespace(value)),
  );
}

function normalizeWhitespace(value: string) {
  return value.replaceAll(/\s+/g, ' ').trim();
}

function pageHasIndexSignals(pageText: string) {
  const normalized = normalizeWhitespace(pageText).toLowerCase();
  return (
    /\b(?:index|contents?|table of contents)\b/.test(normalized) ||
    /\b(?:sr\.?\s*no\.?|page\s*no\.?|topics?)\b/.test(normalized) ||
    /(?:अनुक्रमणिका|विषयसूची|सूची|अ\.क्र\.)/.test(pageText)
  );
}

function isEnglishIndexHeader(line: string) {
  const normalized = normalizeWhitespace(line).toLowerCase();
  return (
    /^(?:index|contents?|table of contents)$/.test(normalized) ||
    (normalized.includes('sr. no') ||
      normalized.includes('sr no') ||
      normalized.includes('page no')) &&
      normalized.includes('topic')
  );
}

function isEnglishIndexStop(line: string) {
  return (
    /^(?:questions?|answers?|explanations?)$/i.test(line) ||
    isUppercaseSectionHeading(line)
  );
}

function isUppercaseSectionHeading(line: string) {
  const normalized = line.replaceAll(/[^A-Za-z0-9 &()./-]+/g, '').trim();
  if (!normalized) {
    return false;
  }

  return normalized === normalized.toUpperCase() && /[A-Z]/.test(normalized);
}

function cleanupLegacyTitle(value: string) {
  return value
    .replace(/\s+Vo\s+\d+$/, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function cleanupEnglishEntryBlock(value: string) {
  return value.replace(/\(\d+\)$/, '').trim();
}

function extractSerialNumber(serialLabel: string) {
  const match = serialLabel.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function safeUnlink(path: string) {
  try {
    await unlink(path);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
