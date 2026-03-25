import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvironmentFile(filePath = resolve(process.cwd(), '.env')) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/u, '$2');

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
