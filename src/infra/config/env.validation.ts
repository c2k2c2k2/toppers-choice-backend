export type EnvironmentVariables = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  API_PREFIX: string;
  SWAGGER_PATH: string;
  SWAGGER_ENABLED: boolean;
  DATABASE_URL?: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  DEFAULT_SITE_CODE: string;
  APP_BASE_URL?: string;
  CORS_ORIGINS: string[];
  SITE_SETTINGS_CACHE_TTL_MS: number;
  OBJECT_STORAGE_ENDPOINT?: string;
  OBJECT_STORAGE_REGION: string;
  OBJECT_STORAGE_BUCKET?: string;
  OBJECT_STORAGE_ACCESS_KEY_ID?: string;
  OBJECT_STORAGE_SECRET_ACCESS_KEY?: string;
  OBJECT_STORAGE_FORCE_PATH_STYLE: boolean;
  PHONEPE_API_BASE_URL?: string;
  PHONEPE_MERCHANT_ID?: string;
  PHONEPE_SALT_KEY?: string;
  PHONEPE_SALT_INDEX?: string;
};

const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const errors: string[] = [];
  const nodeEnv = parseNodeEnv(config.NODE_ENV, errors);
  const port = parseInteger(config.PORT, 'PORT', 3000, errors, {
    min: 1,
    max: 65_535,
  });
  const apiPrefix = parsePathSegment(config.API_PREFIX, 'API_PREFIX', 'api/v1');
  const swaggerPath = parsePathSegment(
    config.SWAGGER_PATH,
    'SWAGGER_PATH',
    'docs',
  );
  const swaggerEnabled = parseBoolean(
    config.SWAGGER_ENABLED,
    'SWAGGER_ENABLED',
    true,
    errors,
  );
  const databaseUrl = parseOptionalString(config.DATABASE_URL);
  const jwtAccessSecret = parseSecret(
    config.JWT_ACCESS_SECRET,
    'JWT_ACCESS_SECRET',
    nodeEnv,
    errors,
    'toppers-choice-dev-access-secret',
  );
  const jwtRefreshSecret = parseSecret(
    config.JWT_REFRESH_SECRET,
    'JWT_REFRESH_SECRET',
    nodeEnv,
    errors,
    'toppers-choice-dev-refresh-secret',
  );
  const defaultSiteCode = parseSiteCode(
    config.DEFAULT_SITE_CODE,
    'DEFAULT_SITE_CODE',
    'toppers-choice',
    errors,
  );
  const appBaseUrl = parseOptionalUrl(
    config.APP_BASE_URL,
    'APP_BASE_URL',
    errors,
  );
  const corsOrigins = parseCsv(config.CORS_ORIGINS);
  const cacheTtl = parseInteger(
    config.SITE_SETTINGS_CACHE_TTL_MS,
    'SITE_SETTINGS_CACHE_TTL_MS',
    30_000,
    errors,
    { min: 1_000 },
  );
  const objectStorageEndpoint = parseOptionalUrl(
    config.OBJECT_STORAGE_ENDPOINT,
    'OBJECT_STORAGE_ENDPOINT',
    errors,
  );
  const objectStorageRegion =
    parseOptionalString(config.OBJECT_STORAGE_REGION) ?? 'us-east-1';
  const objectStorageBucket = parseOptionalString(config.OBJECT_STORAGE_BUCKET);
  const objectStorageAccessKeyId = parseOptionalString(
    config.OBJECT_STORAGE_ACCESS_KEY_ID,
  );
  const objectStorageSecretAccessKey = parseOptionalString(
    config.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  );
  const objectStorageForcePathStyle = parseBoolean(
    config.OBJECT_STORAGE_FORCE_PATH_STYLE,
    'OBJECT_STORAGE_FORCE_PATH_STYLE',
    true,
    errors,
  );
  const phonePeApiBaseUrl = parseOptionalUrl(
    config.PHONEPE_API_BASE_URL,
    'PHONEPE_API_BASE_URL',
    errors,
  );
  const phonePeMerchantId = parseOptionalString(config.PHONEPE_MERCHANT_ID);
  const phonePeSaltKey = parseOptionalString(config.PHONEPE_SALT_KEY);
  const phonePeSaltIndex = parseOptionalString(config.PHONEPE_SALT_INDEX);

  if (!databaseUrl && nodeEnv === 'production') {
    errors.push('DATABASE_URL is required when NODE_ENV=production.');
  }

  if (
    databaseUrl &&
    !databaseUrl.startsWith('postgres://') &&
    !databaseUrl.startsWith('postgresql://')
  ) {
    errors.push('DATABASE_URL must be a PostgreSQL connection string.');
  }

  if (
    objectStorageEndpoint &&
    (!objectStorageBucket ||
      !objectStorageAccessKeyId ||
      !objectStorageSecretAccessKey)
  ) {
    errors.push(
      'OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, and OBJECT_STORAGE_SECRET_ACCESS_KEY are required when OBJECT_STORAGE_ENDPOINT is set.',
    );
  }

  const phonePeConfigValues = [
    phonePeApiBaseUrl,
    phonePeMerchantId,
    phonePeSaltKey,
    phonePeSaltIndex,
  ];
  const hasAnyPhonePeConfig = phonePeConfigValues.some(
    (value) => typeof value === 'string' && value.length > 0,
  );
  const hasAllPhonePeConfig = phonePeConfigValues.every(
    (value) => typeof value === 'string' && value.length > 0,
  );

  if (hasAnyPhonePeConfig && !hasAllPhonePeConfig) {
    errors.push(
      'PHONEPE_API_BASE_URL, PHONEPE_MERCHANT_ID, PHONEPE_SALT_KEY, and PHONEPE_SALT_INDEX must all be provided together when PhonePe is configured.',
    );
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    API_PREFIX: apiPrefix,
    SWAGGER_PATH: swaggerPath,
    SWAGGER_ENABLED: swaggerEnabled,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    DEFAULT_SITE_CODE: defaultSiteCode,
    APP_BASE_URL: appBaseUrl,
    CORS_ORIGINS: corsOrigins,
    SITE_SETTINGS_CACHE_TTL_MS: cacheTtl,
    OBJECT_STORAGE_ENDPOINT: objectStorageEndpoint,
    OBJECT_STORAGE_REGION: objectStorageRegion,
    OBJECT_STORAGE_BUCKET: objectStorageBucket,
    OBJECT_STORAGE_ACCESS_KEY_ID: objectStorageAccessKeyId,
    OBJECT_STORAGE_SECRET_ACCESS_KEY: objectStorageSecretAccessKey,
    OBJECT_STORAGE_FORCE_PATH_STYLE: objectStorageForcePathStyle,
    PHONEPE_API_BASE_URL: phonePeApiBaseUrl,
    PHONEPE_MERCHANT_ID: phonePeMerchantId,
    PHONEPE_SALT_KEY: phonePeSaltKey,
    PHONEPE_SALT_INDEX: phonePeSaltIndex,
  };
}

function parseNodeEnv(
  value: unknown,
  errors: string[],
): EnvironmentVariables['NODE_ENV'] {
  const normalized = parseOptionalString(value) ?? 'development';
  if (
    !NODE_ENV_VALUES.includes(normalized as EnvironmentVariables['NODE_ENV'])
  ) {
    errors.push(`NODE_ENV must be one of: ${NODE_ENV_VALUES.join(', ')}.`);
    return 'development';
  }
  return normalized as EnvironmentVariables['NODE_ENV'];
}

function parseInteger(
  value: unknown,
  key: string,
  fallback: number,
  errors: string[],
  options?: {
    min?: number;
    max?: number;
  },
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    errors.push(`${key} must be an integer.`);
    return fallback;
  }

  if (typeof options?.min === 'number' && parsed < options.min) {
    errors.push(`${key} must be at least ${options.min}.`);
  }

  if (typeof options?.max === 'number' && parsed > options.max) {
    errors.push(`${key} must be at most ${options.max}.`);
  }

  return parsed;
}

function parseBoolean(
  value: unknown,
  key: string,
  fallback: boolean,
  errors: string[],
): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  errors.push(`${key} must be a boolean.`);
  return fallback;
}

function parsePathSegment(
  value: unknown,
  _key: string,
  fallback: string,
): string {
  const rawValue = parseOptionalString(value) ?? fallback;
  const normalized = rawValue.replace(/^\/+|\/+$/g, '');
  return normalized.length > 0 ? normalized : fallback;
}

function parseSiteCode(
  value: unknown,
  key: string,
  fallback: string,
  errors: string[],
): string {
  const normalized = parseOptionalString(value) ?? fallback;
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    errors.push(
      `${key} must contain only lowercase letters, numbers, and hyphens.`,
    );
    return fallback;
  }
  return normalized;
}

function parseOptionalUrl(
  value: unknown,
  key: string,
  errors: string[],
): string | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) {
    return undefined;
  }

  try {
    const url = new URL(parsed);
    return url.toString().replace(/\/$/, '');
  } catch {
    errors.push(`${key} must be a valid URL.`);
    return undefined;
  }
}

function parseCsv(value: unknown): string[] {
  const parsed = parseOptionalString(value);
  if (!parsed) {
    return [];
  }

  return parsed
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseSecret(
  value: unknown,
  key: string,
  nodeEnv: EnvironmentVariables['NODE_ENV'],
  errors: string[],
  fallback: string,
) {
  const parsed = parseOptionalString(value);
  if (parsed) {
    return parsed;
  }

  if (nodeEnv === 'production') {
    errors.push(`${key} is required when NODE_ENV=production.`);
  }

  return fallback;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
