import { UserType } from '@prisma/client';
import { PolicyRequirement } from './authorization.types';

export const POLICY_METADATA_KEY = 'authorization:policy';
export const AUDIT_METADATA_KEY = 'authorization:audit';
export const SELF_ROLE_MANAGEMENT_PERMISSION = 'admin.users.roles.manage';

export const AUTHORIZATION_PERMISSION_DEFINITIONS = [
  {
    key: 'admin.users.read',
    category: 'admin.users',
    description: 'View users and user access summaries.',
  },
  {
    key: 'admin.users.manage',
    category: 'admin.users',
    description: 'Create admin users and manage account status.',
  },
  {
    key: 'admin.users.students.create',
    category: 'admin.users',
    description: 'Create student accounts from an admin context.',
  },
  {
    key: 'admin.users.roles.read',
    category: 'admin.users',
    description: 'View role assignments and direct permission overrides.',
  },
  {
    key: 'admin.users.roles.manage',
    category: 'admin.users',
    description: 'Assign roles and direct permission overrides to users.',
  },
  {
    key: 'admin.roles.read',
    category: 'admin.roles',
    description: 'View role and permission catalog records.',
  },
  {
    key: 'admin.roles.manage',
    category: 'admin.roles',
    description: 'Create and update roles and their permissions.',
  },
  {
    key: 'admin.audit.read',
    category: 'admin.audit',
    description: 'View admin audit logs.',
  },
  {
    key: 'admin.settings.read',
    category: 'admin.settings',
    description: 'View internal admin configuration.',
  },
  {
    key: 'admin.settings.manage',
    category: 'admin.settings',
    description: 'Manage internal admin configuration.',
  },
  {
    key: 'content.notes.read',
    category: 'content.notes',
    description: 'View note management records.',
  },
  {
    key: 'content.notes.manage',
    category: 'content.notes',
    description: 'Create and edit notes.',
  },
  {
    key: 'content.notes.publish',
    category: 'content.notes',
    description: 'Publish notes.',
  },
  {
    key: 'content.cms.read',
    category: 'content.cms',
    description: 'View CMS records.',
  },
  {
    key: 'content.cms.manage',
    category: 'content.cms',
    description: 'Create and edit CMS records.',
  },
  {
    key: 'content.cms.publish',
    category: 'content.cms',
    description: 'Publish CMS records.',
  },
  {
    key: 'content.files.read',
    category: 'content.files',
    description: 'View uploaded file asset records.',
  },
  {
    key: 'content.files.manage',
    category: 'content.files',
    description: 'Upload, confirm, and manage file assets.',
  },
  {
    key: 'academics.taxonomy.read',
    category: 'academics.taxonomy',
    description: 'View taxonomy records.',
  },
  {
    key: 'academics.taxonomy.manage',
    category: 'academics.taxonomy',
    description: 'Create and edit taxonomy records.',
  },
  {
    key: 'academics.questions.read',
    category: 'academics.questions',
    description: 'View question bank records.',
  },
  {
    key: 'academics.questions.manage',
    category: 'academics.questions',
    description: 'Create and edit question bank records.',
  },
  {
    key: 'academics.questions.publish',
    category: 'academics.questions',
    description: 'Publish question bank records.',
  },
  {
    key: 'academics.tests.read',
    category: 'academics.tests',
    description: 'View test definitions and attempts.',
  },
  {
    key: 'academics.tests.manage',
    category: 'academics.tests',
    description: 'Create and edit tests.',
  },
  {
    key: 'academics.tests.publish',
    category: 'academics.tests',
    description: 'Publish tests.',
  },
  {
    key: 'payments.read',
    category: 'payments',
    description: 'View payments and transactions.',
  },
  {
    key: 'payments.manage',
    category: 'payments',
    description: 'Manage payment records and operational actions.',
  },
  {
    key: 'analytics.read',
    category: 'analytics',
    description: 'View analytics and reporting data.',
  },
] as const;

const ALL_PERMISSION_KEYS = AUTHORIZATION_PERMISSION_DEFINITIONS.map(
  ({ key }) => key,
);

export const SYSTEM_ROLE_DEFINITIONS = [
  {
    code: 'admin.super_admin',
    name: 'Super Admin',
    description: 'Full operational control across all current backend modules.',
    userType: UserType.ADMIN,
    isSystem: true,
    permissionKeys: ALL_PERMISSION_KEYS,
  },
  {
    code: 'admin.site_admin',
    name: 'Site Admin',
    description: 'Broad site administration access excluding only future security super-controls.',
    userType: UserType.ADMIN,
    isSystem: true,
    permissionKeys: [
      'admin.users.read',
      'admin.users.manage',
      'admin.users.students.create',
      'admin.users.roles.read',
      'admin.roles.read',
      'admin.audit.read',
      'admin.settings.read',
      'admin.settings.manage',
      'content.notes.read',
      'content.notes.manage',
      'content.notes.publish',
      'content.cms.read',
      'content.cms.manage',
      'content.cms.publish',
      'content.files.read',
      'content.files.manage',
      'academics.taxonomy.read',
      'academics.taxonomy.manage',
      'academics.questions.read',
      'academics.questions.manage',
      'academics.questions.publish',
      'academics.tests.read',
      'academics.tests.manage',
      'academics.tests.publish',
      'payments.read',
      'payments.manage',
      'analytics.read',
    ],
  },
  {
    code: 'admin.content_manager',
    name: 'Content Manager',
    description: 'Content and CMS operations with publishing rights.',
    userType: UserType.ADMIN,
    isSystem: true,
    permissionKeys: [
      'admin.roles.read',
      'content.notes.read',
      'content.notes.manage',
      'content.notes.publish',
      'content.cms.read',
      'content.cms.manage',
      'content.cms.publish',
      'content.files.read',
      'content.files.manage',
      'academics.taxonomy.read',
      'analytics.read',
    ],
  },
  {
    code: 'admin.academic_manager',
    name: 'Academic Manager',
    description: 'Taxonomy, question bank, notes, and testing operations.',
    userType: UserType.ADMIN,
    isSystem: true,
    permissionKeys: [
      'admin.roles.read',
      'content.notes.read',
      'content.notes.manage',
      'content.notes.publish',
      'content.files.read',
      'content.files.manage',
      'academics.taxonomy.read',
      'academics.taxonomy.manage',
      'academics.questions.read',
      'academics.questions.manage',
      'academics.questions.publish',
      'academics.tests.read',
      'academics.tests.manage',
      'academics.tests.publish',
      'analytics.read',
    ],
  },
  {
    code: 'admin.finance_manager',
    name: 'Finance Manager',
    description: 'Payments and financial reporting access.',
    userType: UserType.ADMIN,
    isSystem: true,
    permissionKeys: ['payments.read', 'payments.manage', 'analytics.read'],
  },
  {
    code: 'admin.support_manager',
    name: 'Support Manager',
    description: 'User operations and support-oriented audit visibility.',
    userType: UserType.ADMIN,
    isSystem: true,
    permissionKeys: [
      'admin.users.read',
      'admin.users.manage',
      'admin.users.students.create',
      'admin.users.roles.read',
      'admin.audit.read',
    ],
  },
  {
    code: 'admin.data_entry_operator',
    name: 'Data Entry Operator',
    description: 'Draft content and taxonomy entry without publish rights.',
    userType: UserType.ADMIN,
    isSystem: true,
    permissionKeys: [
      'content.notes.read',
      'content.notes.manage',
      'content.cms.read',
      'content.cms.manage',
      'content.files.read',
      'content.files.manage',
      'academics.taxonomy.read',
      'academics.taxonomy.manage',
    ],
  },
] as const;

export const DEFAULT_ADMIN_POLICY: PolicyRequirement = {
  adminOnly: true,
  match: 'all',
  permissions: [],
};
