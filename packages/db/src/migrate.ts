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
  `CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    task_contract_id TEXT NOT NULL,
    steps_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS durable_jobs (
    id TEXT PRIMARY KEY,
    workflow_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL,
    replay_of_job_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS llm_call_logs (
    id TEXT PRIMARY KEY,
    agent_run_id TEXT NOT NULL,
    prompt_version_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    schema_name TEXT,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    estimated_cost_usd INTEGER NOT NULL,
    retry_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id)
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
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
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
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
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
    invalidation_rule TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS search_documents USING fts5(
    id UNINDEXED,
    project_id UNINDEXED,
    source_type UNINDEXED,
    title,
    body
  )`,
  `CREATE TABLE IF NOT EXISTS review_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    manuscript_version_id TEXT NOT NULL,
    profile_json TEXT NOT NULL,
    findings_json TEXT NOT NULL,
    quality_score_json TEXT NOT NULL,
    open_finding_count INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS revision_suggestions (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    manuscript_version_id TEXT NOT NULL,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    diff_json TEXT NOT NULL,
    risk TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS serialization_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    platform_profile_json TEXT NOT NULL,
    update_schedule_json TEXT NOT NULL,
    experiments_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS reader_feedback (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    segment TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    body TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    lifecycle_status TEXT NOT NULL,
    material_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    embeddings_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`
];

export async function migrateDatabase(client: Client): Promise<void> {
  for (const statement of statements) {
    await client.execute(statement);
  }
}
