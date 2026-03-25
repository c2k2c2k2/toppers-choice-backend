import {
  ConfigStatus,
  ConfigVisibility,
  Prisma,
  PrismaClient,
  SiteStatus,
  UserStatus,
  UserType,
} from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import {
  ACCESS_ROLE_PLACEHOLDER_CONFIG_KEY,
  DEFAULT_SITE_CODE,
  PLATFORM_INTERNAL_RUNTIME_CONFIG_KEY,
  PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
  SITE_PUBLIC_CONFIG_KEY,
} from '../src/modules/site-settings/site-settings.constants';
import { AUTH_RUNTIME_CONFIG_KEY } from '../src/modules/auth/auth.constants';

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

async function main() {
  await prisma.site.updateMany({
    where: {
      code: {
        not: DEFAULT_SITE_CODE,
      },
    },
    data: {
      isDefault: false,
    },
  });

  const site = await prisma.site.upsert({
    where: {
      code: DEFAULT_SITE_CODE,
    },
    update: {
      slug: DEFAULT_SITE_CODE,
      name: "Topper's Choice",
      status: SiteStatus.ACTIVE,
      isDefault: true,
      defaultLocale: 'mr-IN',
      timezone: 'Asia/Kolkata',
    },
    create: {
      code: DEFAULT_SITE_CODE,
      slug: DEFAULT_SITE_CODE,
      name: "Topper's Choice",
      status: SiteStatus.ACTIVE,
      isDefault: true,
      defaultLocale: 'mr-IN',
      timezone: 'Asia/Kolkata',
    },
  });

  await upsertPublishedConfig(site.id, SITE_PUBLIC_CONFIG_KEY, 1, ConfigVisibility.PUBLIC, {
    branding: {
      displayName: "Topper's Choice",
      shortName: "Topper's Choice",
      tagline: 'Competitive exam preparation platform for serious students.',
    },
    support: {
      email: 'support@topperschoice.in',
      phone: '+91-00000-00000',
      whatsapp: '+91-00000-00000',
    },
    locale: {
      defaultLocale: 'mr-IN',
      supportedLocales: ['mr-IN', 'en-IN'],
      timezone: 'Asia/Kolkata',
    },
  });

  await upsertPublishedConfig(
    site.id,
    PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.PUBLIC,
    {
      features: {
        landing: true,
        notes: true,
        practice: true,
        tests: true,
        currentAffairs: true,
        englishSpeaking: true,
      },
      experience: {
        defaultMedium: 'mr',
        supportedMediums: ['mr', 'en'],
      },
      origins: {
        appBaseUrl: null,
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    PLATFORM_INTERNAL_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      previewRules: {
        enabled: true,
        maxPreviewPages: 3,
        watermarkPreview: true,
      },
      publishing: {
        requireAdminReview: true,
        versionedContent: true,
      },
      payments: {
        mode: 'db-driven-placeholder',
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    AUTH_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      tokens: {
        accessTtlMinutes: 15,
        refreshTtlDays: 30,
      },
      passwordReset: {
        codeTtlMinutes: 15,
        maxAttempts: 5,
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    ACCESS_ROLE_PLACEHOLDER_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      adminRoles: [
        'admin.super_admin',
        'admin.content_manager',
        'admin.academic_manager',
        'admin.finance_manager',
        'admin.support_manager',
      ],
      studentRoles: ['student'],
      note: 'Placeholder records for B03/B04 until auth and authorization modules are implemented.',
    },
  );

  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    await prisma.user.upsert({
      where: {
        siteId_email: {
          siteId: site.id,
          email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase(),
        },
      },
      update: {
        fullName:
          process.env.SEED_ADMIN_FULL_NAME?.trim() || "Topper's Choice Admin",
        passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD),
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
      },
      create: {
        siteId: site.id,
        email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase(),
        fullName:
          process.env.SEED_ADMIN_FULL_NAME?.trim() || "Topper's Choice Admin",
        passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD),
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  }

  console.log(`Seeded default site "${site.code}" with baseline runtime configuration.`);
}

async function upsertPublishedConfig(
  siteId: string,
  configKey: string,
  version: number,
  visibility: ConfigVisibility,
  configJson: Prisma.InputJsonObject,
) {
  await prisma.siteConfigVersion.upsert({
    where: {
      siteId_configKey_version: {
        siteId,
        configKey,
        version,
      },
    },
    update: {
      status: ConfigStatus.PUBLISHED,
      visibility,
      configJson,
      publishedAt: new Date(),
    },
    create: {
      siteId,
      configKey,
      version,
      status: ConfigStatus.PUBLISHED,
      visibility,
      configJson,
      publishedAt: new Date(),
    },
  });
}

async function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(value, salt, SCRYPT_KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
