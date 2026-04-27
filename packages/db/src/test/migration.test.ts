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

  it('adds artifact foreign keys to existing context pack tables without losing dependent rows', async () => {
    const database = createDatabase(':memory:');

    try {
      await createSchemaWithOnlyContextPacksMissingArtifactForeignKey(database.client);

      await migrateDatabase(database.client);

      await expectForeignKey(
        database.client,
        'context_packs',
        'artifact_id',
        'artifacts',
        'id'
      );
      await expectForeignKey(
        database.client,
        'agent_runs',
        'context_pack_id',
        'context_packs',
        'id'
      );
      await expectRowCount(database.client, 'context_packs', 1);
      await expectRowCount(database.client, 'agent_runs', 1);
      await expectRowCount(database.client, 'llm_call_logs', 1);
    } finally {
      database.client.close();
    }
  });

  it('adds current-version foreign keys to existing chapter tables', async () => {
    const database = createDatabase(':memory:');

    try {
      await createSchemaWithOnlyChaptersMissingCurrentVersionForeignKey(database.client);

      await migrateDatabase(database.client);

      await expectForeignKey(
        database.client,
        'chapters',
        'current_version_id',
        'chapter_versions',
        'id'
      );
      await expectRowCount(database.client, 'chapters', 1);
      await expectRowCount(database.client, 'chapter_versions', 1);
      await expect(
        database.client.execute("UPDATE chapters SET current_version_id = 'manuscript_version_missing'")
      ).rejects.toThrow();
    } finally {
      database.client.close();
    }
  });

  it('rolls back a chapter rebuild migration if the copy step fails', async () => {
    const database = createDatabase(':memory:');

    try {
      await createSchemaWithOnlyChaptersMissingCurrentVersionForeignKey(database.client);

      let failOnce = true;
      const patchedClient = database.client as typeof database.client & {
        execute: (statement: unknown) => Promise<unknown>;
      };
      const originalExecute = patchedClient.execute.bind(patchedClient);
      patchedClient.execute = (async (statement: unknown) => {
        const sql = typeof statement === 'string' ? statement : (statement as any)?.sql;
        if (failOnce && typeof sql === 'string' && sql.includes('INSERT INTO chapters_current_version_fk_migration')) {
          failOnce = false;
          throw new Error('simulated migration failure');
        }

        return originalExecute(statement as never);
      }) as typeof patchedClient.execute;

      await expect(migrateDatabase(patchedClient)).rejects.toThrow('simulated migration failure');

      patchedClient.execute = originalExecute;

      await expect(migrateDatabase(patchedClient)).resolves.toBeUndefined();
      await expectRowCount(patchedClient, 'chapters', 1);
      await expectRowCount(patchedClient, 'chapter_versions', 1);
      await expectForeignKey(
        patchedClient,
        'chapters',
        'current_version_id',
        'chapter_versions',
        'id'
      );
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

async function expectForeignKey(
  client: ReturnType<typeof createDatabase>['client'],
  tableName: string,
  fromColumn: string,
  referencedTable: string,
  referencedColumn: string
): Promise<void> {
  const result = await client.execute(`PRAGMA foreign_key_list(${tableName})`);

  expect(result.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: fromColumn,
        table: referencedTable,
        to: referencedColumn
      })
    ])
  );
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

async function createSchemaWithOnlyContextPacksMissingArtifactForeignKey(
  client: ReturnType<typeof createDatabase>['client']
): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute(`CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    version INTEGER NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    uri TEXT NOT NULL,
    related_run_id TEXT,
    created_at TEXT NOT NULL
  )`);
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
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id),
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
    'prompt_context_pack_fk',
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
    'context_pack_artifact_fk',
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
    'agent_run_context_pack_fk',
    'Writer Agent',
    'scene_draft',
    'chapter_creation',
    'prompt_context_pack_fk',
    'context_pack_artifact_fk',
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
    'llm_call_context_pack_fk',
    'agent_run_context_pack_fk',
    'prompt_context_pack_fk',
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

async function createSchemaWithOnlyChaptersMissingCurrentVersionForeignKey(
  client: ReturnType<typeof createDatabase>['client']
): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute(`CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    reader_contract_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    version INTEGER NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    uri TEXT NOT NULL,
    related_run_id TEXT,
    created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE manuscripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    manuscript_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    chapter_order INTEGER NOT NULL,
    status TEXT NOT NULL,
    current_version_id TEXT,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE chapter_versions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    body_artifact_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (body_artifact_id) REFERENCES artifacts(id)
  )`);
  await client.execute(`INSERT INTO projects (
    id,
    title,
    language,
    status,
    reader_contract_json,
    created_at,
    updated_at
  ) VALUES (
    'project_current_version_fk',
    'Current Version FK',
    'zh-CN',
    'Active',
    '{}',
    '2026-04-27T06:00:00.000Z',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO artifacts (
    id,
    type,
    source,
    version,
    hash,
    uri,
    created_at
  ) VALUES (
    'artifact_current_version_fk',
    'manuscript_version',
    'user',
    1,
    'sha256:current-version-fk',
    'artifacts/current-version-fk.md',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO manuscripts (
    id,
    project_id,
    title,
    status,
    metadata_json,
    created_at,
    updated_at
  ) VALUES (
    'manuscript_current_version_fk',
    'project_current_version_fk',
    'Current Version FK Manuscript',
    'Active',
    '{}',
    '2026-04-27T06:00:00.000Z',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO chapters (
    id,
    manuscript_id,
    project_id,
    title,
    chapter_order,
    status,
    current_version_id,
    metadata_json,
    created_at,
    updated_at
  ) VALUES (
    'chapter_current_version_fk',
    'manuscript_current_version_fk',
    'project_current_version_fk',
    'Opening',
    1,
    'Draft',
    NULL,
    '{}',
    '2026-04-27T06:00:00.000Z',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(`INSERT INTO chapter_versions (
    id,
    chapter_id,
    body_artifact_id,
    version_number,
    status,
    metadata_json,
    created_at
  ) VALUES (
    'manuscript_version_current_fk',
    'chapter_current_version_fk',
    'artifact_current_version_fk',
    1,
    'Draft',
    '{}',
    '2026-04-27T06:00:00.000Z'
  )`);
  await client.execute(
    "UPDATE chapters SET current_version_id = 'manuscript_version_current_fk' WHERE id = 'chapter_current_version_fk'"
  );
}

async function expectRowCount(
  client: ReturnType<typeof createDatabase>['client'],
  tableName: string,
  expected: number
): Promise<void> {
  const result = await client.execute(`SELECT COUNT(*) AS count FROM ${tableName}`);

  expect(Number(result.rows[0].count)).toBe(expected);
}
