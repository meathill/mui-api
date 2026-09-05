import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const integrationProjects = sqliteTable(
  'integration_projects',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    repository: text('repository').notNull(),
    name: text('name').notNull(),
    billingMode: text('billing_mode', { enum: ['wallet', 'meter_only'] })
      .notNull()
      .default('wallet'),
    defaultsJson: text('defaults_json').notNull().default('{}'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    version: integer('version').notNull().default(1),
    integrationVersion: text('integration_version').notNull().default('1.0.0'),
  },
  (table) => [uniqueIndex('integration_projects_owner_repository').on(table.ownerId, table.repository)],
);

export const providerConnections = sqliteTable('provider_connections', {
  id: text('id').primaryKey(),
  protocol: text('protocol', { enum: ['openai', 'anthropic', 'gemini', 'workers-ai'] }).notNull(),
  baseUrl: text('base_url'),
  credentialRef: text('credential_ref'),
  pricingSource: text('pricing_source').notNull().default('catalog_estimate'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  version: integer('version').notNull().default(1),
});

export const modelConnections = sqliteTable('model_connections', {
  modelId: text('model_id').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => providerConnections.id),
  upstreamModelId: text('upstream_model_id').notNull(),
  version: integer('version').notNull().default(1),
});

export const configurationChanges = sqliteTable(
  'configuration_changes',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    target: text('target').notNull(),
    revision: integer('revision').notNull(),
    beforeJson: text('before_json'),
    afterJson: text('after_json').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('configuration_changes_actor_request').on(table.actorId, table.idempotencyKey),
    uniqueIndex('configuration_changes_target_revision').on(table.target, table.revision),
  ],
);

export const controlDocuments = sqliteTable('control_documents', {
  target: text('target').primaryKey(),
  version: integer('version').notNull(),
  dataJson: text('data_json').notNull(),
});

export const audioModelRates = sqliteTable('audio_model_rates', {
  modelId: text('model_id').primaryKey(),
  unit: text('unit', { enum: ['character', 'second'] }).notNull(),
  pricePerUnit: real('price_per_unit').notNull(),
});
