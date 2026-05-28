import { ConfigService } from '@nestjs/config';
import { ConfigVisibility } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
  SITE_PUBLIC_CONFIG_KEY,
} from './site-settings.constants';
import { SiteSettingsService } from './site-settings.service';

describe('SiteSettingsService', () => {
  const findFirstMock = jest.fn();
  const findManyMock = jest.fn();
  const getConfigMock = jest.fn((key: string) => envValues[key]);
  const prisma = {
    site: {
      findFirst: findFirstMock,
    },
    siteConfigVersion: {
      findMany: findManyMock,
    },
  } as unknown as PrismaService;
  const envValues: Record<string, unknown> = {
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/toppers_choice',
    DEFAULT_SITE_CODE: 'toppers-choice',
    SITE_SETTINGS_CACHE_TTL_MS: 30_000,
    API_PREFIX: 'api/v1',
    APP_BASE_URL: 'http://localhost:3000',
  };
  const configService = {
    get: getConfigMock,
  } as unknown as ConfigService;

  let service: SiteSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SiteSettingsService(prisma, configService);
  });

  it('returns the latest published public bootstrap config and reuses cache', async () => {
    findFirstMock.mockResolvedValue({
      id: 'site_1',
      code: 'toppers-choice',
      slug: 'toppers-choice',
      name: "Toppers' Choice",
      primaryDomain: null,
      defaultLocale: 'mr-IN',
      timezone: 'Asia/Kolkata',
    });
    findManyMock.mockResolvedValue([
      {
        configKey: PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
        version: 2,
        visibility: ConfigVisibility.PUBLIC,
        configJson: {
          features: {
            notes: true,
          },
          origins: {
            appBaseUrl: 'https://api.topperschoice.in',
          },
        },
        publishedAt: new Date('2026-03-25T18:30:00.000Z'),
      },
      {
        configKey: PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
        version: 1,
        visibility: ConfigVisibility.PUBLIC,
        configJson: {
          features: {
            notes: false,
          },
        },
        publishedAt: new Date('2026-03-25T12:00:00.000Z'),
      },
      {
        configKey: SITE_PUBLIC_CONFIG_KEY,
        version: 1,
        visibility: ConfigVisibility.PUBLIC,
        configJson: {
          branding: {
            displayName: "Toppers' Choice",
          },
        },
        publishedAt: new Date('2026-03-25T18:30:00.000Z'),
      },
    ]);

    const first = await service.getPublicBootstrap();
    const second = await service.getPublicBootstrap();

    expect(first.publicConfig.site).toEqual({
      branding: {
        displayName: "Toppers' Choice",
      },
    });
    expect(first.publicConfig.platform).toMatchObject({
      features: {
        notes: true,
      },
    });
    expect(first.runtime.appBaseUrl).toBe('https://api.topperschoice.in');
    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('falls back to env-backed infrastructure values when public runtime config omits them', async () => {
    findFirstMock.mockResolvedValue({
      id: 'site_1',
      code: 'toppers-choice',
      slug: 'toppers-choice',
      name: "Toppers' Choice",
      primaryDomain: null,
      defaultLocale: 'mr-IN',
      timezone: 'Asia/Kolkata',
    });
    findManyMock.mockResolvedValue([
      {
        configKey: PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
        version: 1,
        visibility: ConfigVisibility.PUBLIC,
        configJson: {
          features: {
            notes: true,
          },
        },
        publishedAt: new Date('2026-03-25T18:30:00.000Z'),
      },
      {
        configKey: SITE_PUBLIC_CONFIG_KEY,
        version: 1,
        visibility: ConfigVisibility.PUBLIC,
        configJson: {
          branding: {
            displayName: "Toppers' Choice",
          },
        },
        publishedAt: new Date('2026-03-25T18:30:00.000Z'),
      },
    ]);

    const bootstrap = await service.getPublicBootstrap();

    expect(bootstrap.runtime.appBaseUrl).toBe('http://localhost:3000');
  });
});
