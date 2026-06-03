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
  NOTES_RUNTIME_CONFIG_KEY,
  PLATFORM_INTERNAL_RUNTIME_CONFIG_KEY,
  PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
  SITE_PUBLIC_CONFIG_KEY,
} from '../src/modules/site-settings/site-settings.constants';
import { AUTH_RUNTIME_CONFIG_KEY } from '../src/modules/auth/auth.constants';
import { CMS_RUNTIME_CONFIG_KEY } from '../src/modules/cms/cms.constants';
import { PRACTICE_RUNTIME_CONFIG_KEY } from '../src/modules/practice/practice.constants';
import {
  AUTHORIZATION_PERMISSION_DEFINITIONS,
  SYSTEM_ROLE_DEFINITIONS,
} from '../src/modules/authorization/authorization.constants';
import { PAYMENTS_RUNTIME_CONFIG_KEY } from '../src/modules/payments/payments.constants';
import { NOTIFICATIONS_RUNTIME_CONFIG_KEY } from '../src/modules/notifications/notifications.constants';
import { SEARCH_RUNTIME_CONFIG_KEY } from '../src/modules/search/search.constants';
import { ADMIN_OPS_RUNTIME_CONFIG_KEY } from '../src/modules/admin-ops/admin-ops.constants';
import { ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY } from '../src/modules/english-speaking/english-speaking.constants';
import { syncCanonicalTaxonomy } from './seed-taxonomy';

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
      name: "Toppers' Choice",
      status: SiteStatus.ACTIVE,
      isDefault: true,
      defaultLocale: 'mr-IN',
      timezone: 'Asia/Kolkata',
    },
    create: {
      code: DEFAULT_SITE_CODE,
      slug: DEFAULT_SITE_CODE,
      name: "Toppers' Choice",
      status: SiteStatus.ACTIVE,
      isDefault: true,
      defaultLocale: 'mr-IN',
      timezone: 'Asia/Kolkata',
    },
  });

  await upsertPublishedConfig(
    site.id,
    SITE_PUBLIC_CONFIG_KEY,
    1,
    ConfigVisibility.PUBLIC,
    {
      branding: {
        displayName: "Toppers' Choice",
        shortName: "Toppers' Choice",
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
    },
  );

  await upsertPublishedConfig(
    site.id,
    PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.PUBLIC,
    {
      features: {
        landing: true,
        cms: true,
        notes: true,
        practice: true,
        tests: true,
        currentAffairs: true,
        englishSpeaking: true,
        search: true,
      },
      experience: {
        defaultMedium: 'mr',
        supportedMediums: ['mr', 'en'],
      },
      origins: {
        appBaseUrl: process.env.APP_BASE_URL ?? null,
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
    NOTES_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      preview: {
        defaultPageCount: 3,
      },
      viewSessions: {
        ttlMinutes: 20,
      },
      watermark: {
        enabled: true,
        rotateMinutes: 5,
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    PRACTICE_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      sessions: {
        defaultQuestionCount: 20,
        maxQuestionCount: 100,
      },
      delivery: {
        defaultBatchSize: 10,
        maxBatchSize: 20,
      },
      analytics: {
        trendWindowDays: 7,
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    PAYMENTS_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      providerSelection: {
        activeProvider: 'HDFC_SMARTGATEWAY',
      },
      currency: {
        defaultCurrencyCode: 'INR',
      },
      checkout: {
        orderExpiryMinutes: 30,
        subscriptionMode: 'EXTEND_ACTIVE',
      },
      trial: {
        enabled: true,
        totalMinutes: 24 * 60,
        heartbeatSeconds: 30,
        maxHeartbeatGapSeconds: 90,
      },
      practice: {
        premiumRequired: false,
      },
      providers: {
        hdfc: {
          returnPath: '/payments/result',
        },
        phonepe: {
          payPath: '/pg/v1/pay',
          statusPathTemplate: '/pg/v1/status/{merchantId}/{merchantOrderCode}',
          callbackPath: '/api/v1/payments/providers/phonepe/callback',
          returnPath: '/payments/result',
          redirectMode: 'REDIRECT',
        },
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    CMS_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      resolver: {
        maxPages: 8,
        maxBanners: 8,
        maxAnnouncements: 10,
        maxSections: 12,
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    NOTIFICATIONS_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      feed: {
        maxItems: 25,
      },
      broadcast: {
        maxRecipients: 5000,
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    ENGLISH_SPEAKING_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      tts: {
        modelId: 'eleven_v3',
        outputFormat: 'mp3_22050_32',
        voiceIds: {
          default: 'pNInz6obpgDQGcFmaJgB',
          hindi: '',
          marathi: '',
          english: '',
        },
        voiceSettings: {
          stability: 0.4,
          similarityBoost: 0.8,
          style: 0,
          speed: 1,
          useSpeakerBoost: true,
        },
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    SEARCH_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      public: {
        maxResults: 12,
      },
      student: {
        maxResults: 16,
      },
      admin: {
        maxResults: 20,
      },
    },
  );

  await upsertPublishedConfig(
    site.id,
    ADMIN_OPS_RUNTIME_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      exports: {
        maxRows: 5000,
      },
      security: {
        defaultSignalRows: 50,
      },
    },
  );

  const taxonomySummary = await syncCanonicalTaxonomy(prisma, site.id);

  await upsertPublishedConfig(
    site.id,
    ACCESS_ROLE_PLACEHOLDER_CONFIG_KEY,
    1,
    ConfigVisibility.INTERNAL,
    {
      adminRoles: [
        'admin.super_admin',
        'admin.site_admin',
        'admin.content_manager',
        'admin.academic_manager',
        'admin.finance_manager',
        'admin.support_manager',
        'admin.data_entry_operator',
      ],
      studentRoles: ['student'],
      note: 'Legacy placeholder record retained for tracker continuity. Actual roles and permissions are now stored in authorization tables.',
    },
  );

  const permissionsByKey = await seedPermissions();
  await seedRoles(site.id, permissionsByKey);

  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    const adminUser = await prisma.user.upsert({
      where: {
        siteId_email: {
          siteId: site.id,
          email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase(),
        },
      },
      update: {
        fullName:
          process.env.SEED_ADMIN_FULL_NAME?.trim() || "Toppers' Choice Admin",
        passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD),
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
      },
      create: {
        siteId: site.id,
        email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase(),
        fullName:
          process.env.SEED_ADMIN_FULL_NAME?.trim() || "Toppers' Choice Admin",
        passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD),
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const roleCodes = (
      process.env.SEED_ADMIN_ROLE_CODES?.split(',') ?? ['admin.super_admin']
    )
      .map((roleCode) => roleCode.trim())
      .filter((roleCode) => roleCode.length > 0);

    const roles = await prisma.role.findMany({
      where: {
        siteId: site.id,
        code: {
          in: roleCodes,
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (roles.length !== roleCodes.length) {
      const foundCodes = new Set(roles.map((role) => role.code));
      const missingCodes = roleCodes.filter(
        (roleCode) => !foundCodes.has(roleCode),
      );

      throw new Error(
        `Seed admin role codes not found: ${missingCodes.join(', ')}`,
      );
    }

    await prisma.userRole.deleteMany({
      where: {
        userId: adminUser.id,
      },
    });
    await prisma.userRole.createMany({
      data: roles.map((role) => ({
        userId: adminUser.id,
        roleId: role.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `Seeded default site "${site.code}" with baseline runtime configuration.`,
  );
  console.log(
    `Taxonomy sync: created ${taxonomySummary.createdExamTracks.length} exam track(s), ${taxonomySummary.createdMediums.length} medium(s), ${taxonomySummary.createdSubjects.length} subject(s), and ${taxonomySummary.createdTopics.length} topic(s).`,
  );
  if (taxonomySummary.deactivatedSubjects.length > 0) {
    console.log(
      `Taxonomy sync deactivated ${taxonomySummary.deactivatedSubjects.length} legacy subject(s) and ${taxonomySummary.deactivatedTopics.length} legacy topic(s) to avoid deleting referenced records.`,
    );
  }
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

async function seedPermissions() {
  const permissionsByKey = new Map<string, string>();

  for (const permission of AUTHORIZATION_PERMISSION_DEFINITIONS) {
    const record = await prisma.permission.upsert({
      where: {
        key: permission.key,
      },
      update: {
        category: permission.category,
        description: permission.description,
      },
      create: {
        key: permission.key,
        category: permission.category,
        description: permission.description,
      },
      select: {
        id: true,
        key: true,
      },
    });

    permissionsByKey.set(record.key, record.id);
  }

  return permissionsByKey;
}

async function seedRoles(
  siteId: string,
  permissionsByKey: Map<string, string>,
) {
  for (const roleDefinition of SYSTEM_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: {
        siteId_code: {
          siteId,
          code: roleDefinition.code,
        },
      },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
        userType: roleDefinition.userType,
        isSystem: roleDefinition.isSystem,
        isActive: true,
      },
      create: {
        siteId,
        code: roleDefinition.code,
        name: roleDefinition.name,
        description: roleDefinition.description,
        userType: roleDefinition.userType,
        isSystem: roleDefinition.isSystem,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
      },
    });

    const permissionIds = roleDefinition.permissionKeys.map((permissionKey) => {
      const permissionId = permissionsByKey.get(permissionKey);
      if (!permissionId) {
        throw new Error(`Permission "${permissionKey}" was not seeded.`);
      }

      return permissionId;
    });

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }
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
