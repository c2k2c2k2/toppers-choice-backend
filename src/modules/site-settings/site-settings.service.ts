import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigStatus, ConfigVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  DEFAULT_SITE_CODE,
  PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
  SITE_PUBLIC_CONFIG_KEY,
} from './site-settings.constants';

type SiteSummary = {
  id: string;
  code: string;
  slug: string;
  name: string;
  primaryDomain: string | null;
  defaultLocale: string;
  timezone: string;
};

type SiteVersionSnapshot = {
  key: string;
  version: number;
  visibility: ConfigVisibility;
  publishedAt: string | null;
};

type SiteConfigSnapshot = {
  site: SiteSummary;
  configs: Record<string, Record<string, unknown>>;
  versions: SiteVersionSnapshot[];
  resolvedAt: string;
  stale: boolean;
};

type CachedSiteConfigSnapshot = {
  expiresAt: number;
  snapshot: SiteConfigSnapshot;
};

type SiteLookupOptions = {
  siteCode?: string;
  forceRefresh?: boolean;
  visibility?: ConfigVisibility | 'ALL';
};

type SiteSettingLookupOptions<T> = SiteLookupOptions & {
  fallback: T;
  envFallbackKey?: string;
};

type SiteNumberLookupOptions = SiteSettingLookupOptions<number> & {
  min?: number;
  max?: number;
  integer?: boolean;
};

@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);
  private readonly cache = new Map<string, CachedSiteConfigSnapshot>();
  private readonly pendingLoads = new Map<
    string,
    Promise<SiteConfigSnapshot>
  >();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs =
      this.configService.get<number>('SITE_SETTINGS_CACHE_TTL_MS') ?? 30_000;
  }

  async getPublicBootstrap(siteCode?: string) {
    const snapshot = await this.getRuntimeSnapshot({
      siteCode,
      visibility: ConfigVisibility.PUBLIC,
    });
    const appBaseUrl = await this.getStringSetting(
      PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
      'origins.appBaseUrl',
      {
        siteCode,
        visibility: ConfigVisibility.PUBLIC,
        fallback: '',
        envFallbackKey: 'APP_BASE_URL',
      },
    );

    return {
      site: snapshot.site,
      publicConfig: {
        site: snapshot.configs[SITE_PUBLIC_CONFIG_KEY] ?? {},
        platform: snapshot.configs[PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY] ?? {},
      },
      runtime: {
        appBaseUrl: appBaseUrl || null,
        apiBasePath: `/${this.configService.get<string>('API_PREFIX') ?? 'api/v1'}`,
      },
      versions: snapshot.versions,
      resolvedAt: snapshot.resolvedAt,
      stale: snapshot.stale,
    };
  }

  async getRuntimeSnapshot(
    options: SiteLookupOptions = {},
  ): Promise<SiteConfigSnapshot> {
    this.assertDatabaseConfigured();

    const site = await this.resolveSite(options.siteCode);
    const snapshot = await this.loadSnapshot(
      site,
      options.forceRefresh ?? false,
    );

    return this.filterSnapshot(snapshot, options.visibility ?? 'ALL');
  }

  async getObjectConfig(
    configKey: string,
    options: SiteLookupOptions = {},
  ): Promise<Record<string, unknown> | null> {
    const snapshot = await this.getRuntimeSnapshot(options);
    return snapshot.configs[configKey] ?? null;
  }

  async getStringSetting(
    configKey: string,
    path: string,
    options: SiteSettingLookupOptions<string>,
  ) {
    const value = await this.getSettingValue(configKey, path, options);
    const envFallback = options.envFallbackKey
      ? this.configService.get<string>(options.envFallbackKey)
      : undefined;

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    if (typeof envFallback === 'string' && envFallback.trim().length > 0) {
      return envFallback;
    }

    return options.fallback;
  }

  async getBooleanSetting(
    configKey: string,
    path: string,
    options: SiteSettingLookupOptions<boolean>,
  ) {
    const value = await this.getSettingValue(configKey, path, options);
    const envFallback = options.envFallbackKey
      ? this.configService.get<boolean>(options.envFallbackKey)
      : undefined;

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof envFallback === 'boolean') {
      return envFallback;
    }

    return options.fallback;
  }

  async getNumberSetting(
    configKey: string,
    path: string,
    options: SiteNumberLookupOptions,
  ) {
    const value = await this.getSettingValue(configKey, path, options);
    const envFallback = options.envFallbackKey
      ? this.configService.get<number>(options.envFallbackKey)
      : undefined;
    const parsed =
      this.coerceNumber(value, options) ??
      this.coerceNumber(envFallback, options) ??
      options.fallback;

    return parsed;
  }

  private async getSettingValue(
    configKey: string,
    path: string,
    options: SiteLookupOptions = {},
  ) {
    const config = await this.getObjectConfig(configKey, options);
    if (!config) {
      return undefined;
    }

    return path.split('.').reduce<unknown>((currentValue, segment) => {
      if (!this.isRecord(currentValue)) {
        return undefined;
      }

      return currentValue[segment];
    }, config);
  }

  private async resolveSite(siteCode?: string): Promise<SiteSummary> {
    const requestedSiteCode =
      siteCode?.trim() ||
      this.configService.get<string>('DEFAULT_SITE_CODE') ||
      DEFAULT_SITE_CODE;
    const site = await this.prisma.site.findFirst({
      where: {
        code: requestedSiteCode,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
        primaryDomain: true,
        defaultLocale: true,
        timezone: true,
      },
    });

    if (site) {
      return site;
    }

    if (!siteCode) {
      const defaultSite = await this.prisma.site.findFirst({
        where: {
          isDefault: true,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          code: true,
          slug: true,
          name: true,
          primaryDomain: true,
          defaultLocale: true,
          timezone: true,
        },
      });

      if (defaultSite) {
        return defaultSite;
      }
    }

    throw new NotFoundException({
      code: 'SITE_NOT_FOUND',
      message: `Active site "${requestedSiteCode}" was not found.`,
      details: {
        siteCode: requestedSiteCode,
      },
    });
  }

  private async loadSnapshot(
    site: SiteSummary,
    forceRefresh: boolean,
  ): Promise<SiteConfigSnapshot> {
    const cached = this.cache.get(site.code);
    const now = Date.now();

    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.snapshot;
    }

    const inFlight = this.pendingLoads.get(site.code);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = this.readPublishedConfig(site)
      .then((snapshot) => {
        this.cache.set(site.code, {
          expiresAt: Date.now() + this.cacheTtlMs,
          snapshot,
        });

        return snapshot;
      })
      .catch((error: unknown) => {
        if (cached) {
          this.logger.warn(
            `Falling back to stale config cache for site "${site.code}": ${this.formatError(
              error,
            )}`,
          );

          return {
            ...cached.snapshot,
            stale: true,
          };
        }

        throw error;
      })
      .finally(() => {
        this.pendingLoads.delete(site.code);
      });

    this.pendingLoads.set(site.code, loadPromise);
    return loadPromise;
  }

  private async readPublishedConfig(
    site: SiteSummary,
  ): Promise<SiteConfigSnapshot> {
    const versions = await this.prisma.siteConfigVersion.findMany({
      where: {
        siteId: site.id,
        status: ConfigStatus.PUBLISHED,
      },
      orderBy: [{ configKey: 'asc' }, { version: 'desc' }],
      select: {
        configKey: true,
        version: true,
        visibility: true,
        configJson: true,
        publishedAt: true,
      },
    });

    const latestByKey = new Map<
      string,
      {
        version: number;
        visibility: ConfigVisibility;
        configJson: Prisma.JsonValue;
        publishedAt: Date | null;
      }
    >();

    for (const version of versions) {
      if (!latestByKey.has(version.configKey)) {
        latestByKey.set(version.configKey, version);
      }
    }

    const snapshotVersions = Array.from(latestByKey.entries()).map(
      ([key, version]) => ({
        key,
        version: version.version,
        visibility: version.visibility,
        publishedAt: version.publishedAt?.toISOString() ?? null,
      }),
    );
    const configs = Array.from(latestByKey.entries()).reduce<
      Record<string, Record<string, unknown>>
    >((accumulator, [key, version]) => {
      accumulator[key] = this.asRecord(version.configJson) ?? {};
      return accumulator;
    }, {});

    return {
      site,
      configs,
      versions: snapshotVersions,
      resolvedAt: new Date().toISOString(),
      stale: false,
    };
  }

  private filterSnapshot(
    snapshot: SiteConfigSnapshot,
    visibility: ConfigVisibility | 'ALL',
  ): SiteConfigSnapshot {
    if (visibility === 'ALL') {
      return snapshot;
    }

    const filteredVersions = snapshot.versions.filter(
      (version) => version.visibility === visibility,
    );
    const allowedKeys = new Set(filteredVersions.map((version) => version.key));
    const filteredConfigs = Object.fromEntries(
      Object.entries(snapshot.configs).filter(([key]) => allowedKeys.has(key)),
    );

    return {
      ...snapshot,
      configs: filteredConfigs,
      versions: filteredVersions,
    };
  }

  private coerceNumber(
    value: unknown,
    options: Pick<SiteNumberLookupOptions, 'min' | 'max' | 'integer'>,
  ) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    if (!Number.isFinite(parsed)) {
      return undefined;
    }

    if (options.integer && !Number.isInteger(parsed)) {
      return undefined;
    }

    if (typeof options.min === 'number' && parsed < options.min) {
      return undefined;
    }

    if (typeof options.max === 'number' && parsed > options.max) {
      return undefined;
    }

    return parsed;
  }

  private assertDatabaseConfigured() {
    if (!this.configService.get<string>('DATABASE_URL')) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_NOT_CONFIGURED',
        message:
          'Site settings are unavailable until DATABASE_URL is configured.',
        details: {
          dependency: 'database',
        },
      });
    }
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (this.isRecord(value)) {
      return value;
    }

    return null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
