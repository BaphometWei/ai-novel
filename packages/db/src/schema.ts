import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  language: text('language').notNull(),
  status: text('status').notNull(),
  readerContractJson: text('reader_contract_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  source: text('source').notNull(),
  version: integer('version').notNull(),
  hash: text('hash').notNull().unique(),
  uri: text('uri').notNull(),
  createdAt: text('created_at').notNull()
});

export const contextPacks = sqliteTable('context_packs', {
  id: text('id').primaryKey(),
  taskGoal: text('task_goal').notNull(),
  agentRole: text('agent_role').notNull(),
  riskLevel: text('risk_level').notNull(),
  sectionsJson: text('sections_json').notNull(),
  citationsJson: text('citations_json').notNull(),
  exclusionsJson: text('exclusions_json').notNull(),
  warningsJson: text('warnings_json').notNull(),
  retrievalTraceJson: text('retrieval_trace_json').notNull(),
  createdAt: text('created_at').notNull()
});

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  agentName: text('agent_name').notNull(),
  taskType: text('task_type').notNull(),
  workflowType: text('workflow_type').notNull(),
  promptVersionId: text('prompt_version_id').notNull(),
  contextPackId: text('context_pack_id').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull()
});
