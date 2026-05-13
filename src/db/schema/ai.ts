import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const knowledgeItems = pgTable(
  'knowledge_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    itemType: text('item_type').notNull().default('Other'),
    status: text('status').notNull().default('Active'),
    body: text('body'),
    url: text('url'),
    tagsJson: text('tags_json'),
    sourceMetadataJson: text('source_metadata_json'),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_knowledge_items_company').on(t.companyId),
    typeIdx: index('idx_knowledge_items_type').on(t.companyId, t.itemType),
  }),
);

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New conversation'),
    selectedModel: text('selected_model'),
    conversationType: text('conversation_type').notNull().default('assistant'),
    status: text('status').notNull().default('Active'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_ai_conversations_company').on(t.companyId),
  }),
);

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    model: text('model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    estimatedCostUsd: text('estimated_cost_usd'),
    contextSnapshotJson: text('context_snapshot_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    conversationIdx: index('idx_ai_messages_conversation').on(t.conversationId),
    companyIdx: index('idx_ai_messages_company').on(t.companyId),
  }),
);

export const aiActionDrafts = pgTable(
  'ai_action_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => aiConversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => aiMessages.id, { onDelete: 'cascade' }),
    actionType: text('action_type').notNull(),
    title: text('title').notNull(),
    payloadJson: text('payload_json'),
    status: text('status').notNull().default('Draft'),
    relatedRecordType: text('related_record_type'),
    relatedRecordId: uuid('related_record_id'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_ai_action_drafts_company').on(t.companyId),
    conversationIdx: index('idx_ai_action_drafts_conversation').on(t.conversationId),
  }),
);
