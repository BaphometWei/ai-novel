import type { Client } from '@libsql/client';

const statements = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA foreign_keys = ON',
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    reader_contract_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    version INTEGER NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    uri TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS context_packs (
    id TEXT PRIMARY KEY,
    task_goal TEXT NOT NULL,
    agent_role TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    sections_json TEXT NOT NULL,
    citations_json TEXT NOT NULL,
    exclusions_json TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    retrieval_trace_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    workflow_type TEXT NOT NULL,
    prompt_version_id TEXT NOT NULL,
    context_pack_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (context_pack_id) REFERENCES context_packs(id)
  )`,
  `CREATE TABLE IF NOT EXISTS canon_facts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL,
    source_references_json TEXT NOT NULL,
    confirmation_trail_json TEXT NOT NULL,
    ledger_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    reason TEXT NOT NULL,
    proposed_action TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dependency_index_entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_object_json TEXT NOT NULL,
    target_object_json TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    dependency_type TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    source_run_id TEXT NOT NULL,
    invalidation_rule TEXT NOT NULL
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS search_documents USING fts5(
    id UNINDEXED,
    project_id UNINDEXED,
    source_type UNINDEXED,
    title,
    body
  )`
];

export async function migrateDatabase(client: Client): Promise<void> {
  for (const statement of statements) {
    await client.execute(statement);
  }
}
