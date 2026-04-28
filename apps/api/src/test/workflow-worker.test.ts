import { createDatabase, DurableJobRepository, migrateDatabase, WorkflowRunRepository } from '@ai-novel/db';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createDurableWorkerService } from '../services/durable-worker.service';

describe('workflow worker API', () => {
  it('claims and executes a due durable job through a registered handler', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const durableJobs = new DurableJobRepository(database.db);
    const worker = createDurableWorkerService({
      durableJobs,
      handlers: [
        {
          workflowType: 'test.echo',
          async run(job) {
            return { echoed: job.payload.message };
          }
        }
      ],
      clock: () => '2026-04-28T00:00:00.000Z'
    });
    const app = buildApp({
      workflow: {
        durableJobs,
        workflowRuns: new WorkflowRunRepository(database.db),
        worker
      }
    });

    const created = await app.inject({
      method: 'POST',
      url: '/workflow/jobs',
      payload: { workflowType: 'test.echo', payload: { message: 'hello' } }
    });

    const workerRun = await app.inject({ method: 'POST', url: '/workflow/worker/run-once' });
    const reloaded = await app.inject({ method: 'GET', url: `/workflow/jobs/${created.json().id}` });

    expect(workerRun.statusCode).toBe(200);
    expect(workerRun.json()).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(reloaded.json()).toMatchObject({
      id: created.json().id,
      status: 'Succeeded',
      payload: { message: 'hello', output: { echoed: 'hello' } }
    });

    database.client.close();
    await app.close();
  });

  it('persists cancellation requests and creates replay lineage jobs', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const durableJobs = new DurableJobRepository(database.db);
    const worker = createDurableWorkerService({
      durableJobs,
      handlers: [],
      clock: () => '2026-04-28T00:00:00.000Z'
    });
    const app = buildApp({
      workflow: {
        durableJobs,
        workflowRuns: new WorkflowRunRepository(database.db),
        worker
      }
    });

    const created = await app.inject({
      method: 'POST',
      url: '/workflow/jobs',
      payload: { workflowType: 'test.echo', payload: { message: 'hello' } }
    });

    const cancel = await app.inject({
      method: 'POST',
      url: `/workflow/jobs/${created.json().id}/cancel`,
      payload: { reason: 'operator' }
    });
    const replay = await app.inject({ method: 'POST', url: `/workflow/jobs/${created.json().id}/replay` });
    const lineage = await app.inject({ method: 'GET', url: `/workflow/jobs/${replay.json().id}/replay-lineage` });

    expect(cancel.statusCode).toBe(200);
    expect(cancel.json()).toMatchObject({
      id: created.json().id,
      cancelRequestedAt: '2026-04-28T00:00:00.000Z',
      payload: { cancelReason: 'operator' }
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({
      status: 'Queued',
      replayOfJobId: created.json().id,
      payload: { message: 'hello' }
    });
    expect(lineage.json()).toEqual({ jobIds: [created.json().id, replay.json().id] });

    database.client.close();
    await app.close();
  });
});
