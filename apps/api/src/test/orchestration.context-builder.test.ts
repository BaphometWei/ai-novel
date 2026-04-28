import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('orchestration context source', () => {
  it('builds context server-side and ignores caller supplied context sections', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    await seedProject(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/orchestration/runs',
      payload: {
        projectId: 'project_seed',
        workflowType: 'chapter.plan',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan with server context',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        retrieval: {
          query: 'server context'
        },
        contextSections: [{ name: 'caller_context', content: 'must not appear' }]
      }
    });

    expect(response.statusCode).toBe(201);
    const detail = response.json();
    expect(JSON.stringify(detail.contextPack.sections)).not.toContain('must not appear');
    expect(detail.contextPack.retrievalTrace.join('\n')).toContain('query:server context');

    runtime.database.client.close();
    await runtime.app.close();
  });

  it('uses server-side context even when retrieval options are omitted', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    await seedProject(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/orchestration/runs',
      payload: {
        projectId: 'project_seed',
        workflowType: 'chapter.plan',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan without caller context',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        contextSections: [{ name: 'caller_context', content: 'must not appear without retrieval either' }]
      }
    });

    expect(response.statusCode).toBe(201);
    const detail = response.json();
    expect(JSON.stringify(detail.contextPack.sections)).not.toContain('must not appear without retrieval either');
    expect(detail.contextPack.retrievalTrace.join('\n')).toContain('query:Plan without caller context');

    runtime.database.client.close();
    await runtime.app.close();
  });
});

async function seedProject(client: { execute(sql: string): Promise<unknown> }) {
  await client.execute(`INSERT INTO projects (id, title, language, status, reader_contract_json, created_at, updated_at) VALUES (
    'project_seed', 'Seed Project', 'zh-CN', 'Active', '{}', '2026-04-28T00:00:00.000Z', '2026-04-28T00:00:00.000Z'
  )`);
}
