import { createDatabase, DurableJobRepository, migrateDatabase, WorkflowRunRepository } from '@ai-novel/db';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('workflow API routes', () => {
  it('creates workflow runs and resumes them through persisted repositories', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const app = buildApp({
      workflow: {
        durableJobs: new DurableJobRepository(database.db),
        workflowRuns: new WorkflowRunRepository(database.db)
      }
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/workflow/runs',
      payload: {
        taskContract: {
          projectId: 'project_abc',
          taskType: 'chapter_planning',
          agentRole: 'Planner Agent',
          riskLevel: 'Medium',
          outputSchema: 'ChapterPlan'
        },
        steps: [{ name: 'build_context', artifactIds: ['artifact_context'], status: 'Succeeded' }]
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const run = createResponse.json();
    expect(run).toMatchObject({
      taskContractId: expect.stringMatching(/^task_contract_/),
      steps: [{ order: 1, name: 'build_context', status: 'Succeeded', retryAttempt: 0 }]
    });

    const resumeResponse = await app.inject({
      method: 'POST',
      url: `/workflow/runs/${run.id}/steps`,
      payload: {
        name: 'generate_plan',
        artifactIds: ['artifact_plan'],
        status: 'Failed',
        error: 'schema mismatch',
        retryAttempt: 1
      }
    });

    expect(resumeResponse.statusCode).toBe(200);
    expect(resumeResponse.json()).toMatchObject({
      id: run.id,
      steps: [
        { order: 1, name: 'build_context', status: 'Succeeded' },
        { order: 2, name: 'generate_plan', status: 'Failed', error: 'schema mismatch', retryAttempt: 1 }
      ]
    });

    const reloadResponse = await app.inject({ method: 'GET', url: `/workflow/runs/${run.id}` });
    expect(reloadResponse.json()).toMatchObject(resumeResponse.json());
    database.client.close();
  });

  it('advances durable job status and exposes replay lineage through persisted repositories', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const app = buildApp({
      workflow: {
        durableJobs: new DurableJobRepository(database.db),
        workflowRuns: new WorkflowRunRepository(database.db)
      }
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/workflow/jobs',
      payload: { workflowType: 'deep_review', payload: { chapterId: 'chapter_abc' } }
    });
    const job = createResponse.json();

    const retryResponse = await app.inject({
      method: 'PATCH',
      url: `/workflow/jobs/${job.id}/status`,
      payload: { status: 'Retrying' }
    });

    const replayResponse = await app.inject({ method: 'POST', url: `/workflow/jobs/${job.id}/replay` });
    const replay = replayResponse.json();
    const lineageResponse = await app.inject({ method: 'GET', url: `/workflow/jobs/${replay.id}/replay-lineage` });

    expect(createResponse.statusCode).toBe(201);
    expect(retryResponse.json()).toMatchObject({ id: job.id, status: 'Retrying', retryCount: 1 });
    expect(replayResponse.statusCode).toBe(201);
    expect(replay).toMatchObject({ status: 'Queued', replayOfJobId: job.id });
    expect(lineageResponse.json()).toEqual({ jobIds: [job.id, replay.id] });
    database.client.close();
  });

  it('rejects workflow runs for invalid project ids', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/workflow/runs',
      payload: {
        taskContract: {
          projectId: 'not_a_project_id',
          taskType: 'chapter_planning',
          agentRole: 'Planner Agent',
          riskLevel: 'Medium',
          outputSchema: 'ChapterPlan'
        },
        steps: []
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'Invalid workflow payload' });
  });
});
