import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';

describe('database migrations', () => {
  it('adds prompt-version foreign keys to existing V1 agent run and LLM log tables', async () => {
    const database = createDatabase(':memory:');

    try {
      await createV1SchemaWithoutPromptVersionForeignKeys(database.client);

      await migrateDatabase(database.client);

      await expectPromptVersion(database.client, 'prompt_orphan_agent_run');
      await expectPromptVersion(database.client, 'prompt_orphan_llm_log');
      await expectRowCount(database.client, 'agent_runs', 1);
      await expectRowCount(database.client, 'llm_call_logs', 1);

      await expect(
        database.client.execute(`INSERT INTO agent_runs (
          id,
          agent_name,
          task_type,
          workflow_type,
          prompt_version_id,
          context_pack_id,
          status,
          created_at
        ) VALUES (
          'agent_run_missing_prompt',
          'Writer Agent',
          'scene_draft',
          'chapter_creation',
          'prompt_missing',
          'context_pack_v1',
          'Queued',
          '2026-04-27T06:00:00.000Z'
        )`)
      ).rejects.toThrow();

      await expect(
        database.client.execute(`INSERT INTO llm_call_logs (
          id,
          agent_run_id,
          prompt_version_id,
          provider,
          model,
          input_tokens,
          output_tokens,
          duration_ms,
          estimated_cost_usd,
          retry_count,
          status,
          created_at
        ) VALUES (
          'llm_call_missing_prompt',
          'agent_run_v1',
          'prompt_missing',
          'fake',
          'fake-model',
          1,
          1,
          1,
          1,
          0,
          'Succeeded',
          '2026-04-27T06:00:00.000Z'
        )`)
      ).rejects.toThrow();
    } finally {
      database.client.close();
    }
  });

  it('keeps LLM log foreign keys valid when only agent runs need rebuilding', async () => {
    const database = createDatabase(':memory:');

    try {
      await createSchemaWithOnlyAgentRunsMissingPromptVersionForeignKey(database.client);

      await migrateDatabase(database.client);

      await expectRowCount(database.client, 'agent_runs', 1);
      await expectRowCount(database.client, 'llm_call_logs', 1);

      await expect(
        database.client.execute(`INSERT INTO llm_call_logs (
          id,
          agent_run_id,
          prompt_version_id,
          provider,
          model,
          input_tokens,
          output_tokens,
          duration_ms,
          estimated_cost_usd,
          retry_count,
          status,
          created_at
        ) VALUES (
          'llm_call_after_partial_migration',
          'agent_run_partial',
          'prompt_partial',
          'fake',
          'fake-model',
          1,
          1,
          1,
          1,
          0,
          'Succeeded',
          '2026-04-27T06:00:00.000Z'
        )`)
      ).resolves.toBeDefined();
    } finally {
      database.client.close();
    }
  });
});

async function createV1SchemaWithoutPromptVersionForeignKeys(
  client: ReturnType<typeof createDatabase>['client']
): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute(`CREATE TABLE context_packs (
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
  )`);
  await client.execute(`CREATE TABLE agent_runs (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    workflow_type TEXT NOT NULL,
    prompt_version_id TEXT NOT NULL,
    context_pack_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (context_pack_id) REFERENCES context_packs(id)
  )`);
  await client.execute(`CREATE TABLE llm_call_logs (
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
  )`);
  await client.execute(`INSERT INTO context_packs (
    id,
    task_goal,
    agent_role,
    risk_level,
    sections_json,
    citations_json,
    exclusions_json,
    warnings_json,
    retrieval_trace_json,
    created_at
  ) VALUES (
    'context_pack_v1',
    'Draft a scene',
    'Writer Agent',
    'Medium',
    '[]',
    '[]',
    '[]',
    '[]',
    '[]',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO agent_runs (
    id,
    agent_name,
    task_type,
    workflow_type,
    prompt_version_id,
    context_pack_id,
    status,
    created_at
  ) VALUES (
    'agent_run_v1',
    'Writer Agent',
    'scene_draft',
    'chapter_creation',
    'prompt_orphan_agent_run',
    'context_pack_v1',
    'Queued',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO llm_call_logs (
    id,
    agent_run_id,
    prompt_version_id,
    provider,
    model,
    input_tokens,
    output_tokens,
    duration_ms,
    estimated_cost_usd,
    retry_count,
    status,
    created_at
  ) VALUES (
    'llm_call_v1',
    'agent_run_v1',
    'prompt_orphan_llm_log',
    'fake',
    'fake-model',
    1,
    1,
    1,
    1,
    0,
    'Succeeded',
    '2026-04-27T06:00:00.000Z'
  )`);
}

async function expectPromptVersion(
  client: ReturnType<typeof createDatabase>['client'],
  id: string
): Promise<void> {
  const result = await client.execute({
    sql: 'SELECT id FROM prompt_versions WHERE id = ?',
    args: [id]
  });

  expect(result.rows).toHaveLength(1);
}

async function createSchemaWithOnlyAgentRunsMissingPromptVersionForeignKey(
  client: ReturnType<typeof createDatabase>['client']
): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute(`CREATE TABLE prompt_versions (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL,
    template TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE context_packs (
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
  )`);
  await client.execute(`CREATE TABLE agent_runs (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    workflow_type TEXT NOT NULL,
    prompt_version_id TEXT NOT NULL,
    context_pack_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (context_pack_id) REFERENCES context_packs(id)
  )`);
  await client.execute(`CREATE TABLE llm_call_logs (
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
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id),
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
  )`);
  await client.execute(`INSERT INTO prompt_versions (
    id,
    task_type,
    template,
    model,
    provider,
    version,
    status,
    created_at
  ) VALUES (
    'prompt_partial',
    'scene_draft',
    'Draft from {{context}}',
    'fake-model',
    'fake',
    1,
    'Active',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO context_packs (
    id,
    task_goal,
    agent_role,
    risk_level,
    sections_json,
    citations_json,
    exclusions_json,
    warnings_json,
    retrieval_trace_json,
    created_at
  ) VALUES (
    'context_pack_partial',
    'Draft a scene',
    'Writer Agent',
    'Medium',
    '[]',
    '[]',
    '[]',
    '[]',
    '[]',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO agent_runs (
    id,
    agent_name,
    task_type,
    workflow_type,
    prompt_version_id,
    context_pack_id,
    status,
    created_at
  ) VALUES (
    'agent_run_partial',
    'Writer Agent',
    'scene_draft',
    'chapter_creation',
    'prompt_partial',
    'context_pack_partial',
    'Queued',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO llm_call_logs (
    id,
    agent_run_id,
    prompt_version_id,
    provider,
    model,
    input_tokens,
    output_tokens,
    duration_ms,
    estimated_cost_usd,
    retry_count,
    status,
    created_at
  ) VALUES (
    'llm_call_partial',
    'agent_run_partial',
    'prompt_partial',
    'fake',
    'fake-model',
    1,
    1,
    1,
    1,
    0,
    'Succeeded',
    '2026-04-27T06:00:00.000Z'
  )`);
}

async function expectRowCount(
  client: ReturnType<typeof createDatabase>['client'],
  tableName: string,
  expected: number
): Promise<void> {
  const result = await client.execute(`SELECT COUNT(*) AS count FROM ${tableName}`);

  expect(Number(result.rows[0].count)).toBe(expected);
}
