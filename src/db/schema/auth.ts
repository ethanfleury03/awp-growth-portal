import { pgTable, text, timestamp, boolean, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { companies, branches } from './companies';

export const portalUsers = pgTable(
  'portal_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    email: text('email').notNull().unique(),
    name: text('name').notNull().default(''),
    hashedPw: text('hashed_pw').notNull().default(''),
    role: text('role').notNull().default('staff'),
    isActive: boolean('is_active').notNull().default(true),
    clerkUserId: text('clerk_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index('idx_portal_users_email').on(t.email),
    clerkIdx: uniqueIndex('idx_portal_users_clerk_user_id').on(t.clerkUserId),
  }),
);

export const userMemberships = pgTable(
  'user_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    role: text('role').notNull().default('staff'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_user_memberships_user_id').on(t.userId),
    companyIdx: index('idx_user_memberships_company_id').on(t.companyId),
  }),
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    role: text('role').notNull(),
    permission: text('permission').notNull(),
    scope: text('scope').notNull().default('company'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unique: uniqueIndex('role_permissions_role_permission_scope_unique').on(
      t.role,
      t.permission,
      t.scope,
    ),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    actorUserId: text('actor_user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    payloadJson: text('payload_json'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_audit_logs_company_id').on(t.companyId),
    branchIdx: index('idx_audit_logs_branch_id').on(t.branchId),
    createdIdx: index('idx_audit_logs_created_at').on(t.createdAt),
  }),
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    createdByUserId: text('created_by_user_id'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_api_keys_company_id').on(t.companyId),
    branchIdx: index('idx_api_keys_branch_id').on(t.branchId),
  }),
);

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    externalAccountId: text('external_account_id'),
    status: text('status').notNull().default('disconnected'),
    configJson: text('config_json'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_integration_connections_company_id').on(t.companyId),
    branchIdx: index('idx_integration_connections_branch_id').on(t.branchId),
  }),
);
