import { createDurableJob, replayJob, transitionJob, type WorkflowRun, WorkflowRunner, createTaskContract } from '@ai-novel/workflow';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { DurableJobRepository } from '../repositories/durable-job.repository';
import { WorkflowRunRepository } from '../repositories/workflow-run.repository';

describe('workflow persistence', () => {
  it('stores workflow runs and resumes ordered steps after reload', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const workflowRuns = new WorkflowRunRepository(database.db);
    const runner = new WorkflowRunner();
    const contract = createTaskContract({
      projectId: 'project_abc',
      taskType: 'chapter_planning',
      agentRole: 'Planner Agent',
      riskLevel: 'Medium',
      outputSchema: 'ChapterPlan'
    });

    const firstPass = await runner.run(contract, [
      { name: 'build_context', artifactIds: ['artifact_context'], status: 'Succeeded' }
    ]);
    await workflowRuns.save(firstPass);

    const reloaded = await workflowRuns.findById(firstPass.id);
    const resumed = runner.resume(reloaded as WorkflowRun, {
      name: 'generate_plan',
      artifactIds: ['artifact_plan'],
      status: 'Failed',
      error: 'schema mismatch',
      retryAttempt: 1
    });
    await workflowRuns.save(resumed);

    await expect(workflowRuns.findById(firstPass.id)).resolves.toMatchObject({
      id: firstPass.id,
      taskContractId: contract.id,
      steps: [
        { order: 1, name: 'build_context', artifactIds: ['artifact_context'], status: 'Succeeded' },
        { order: 2, name: 'generate_plan', artifactIds: ['artifact_plan'], status: 'Failed', error: 'schema mismatch', retryAttempt: 1 }
      ]
    });
    database.client.close();
  });

  it('upserts durable job state and resolves replay lineage', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const durableJobs = new DurableJobRepository(database.db);
    const queued = createDurableJob({ workflowType: 'deep_review', payload: { chapterId: 'chapter_abc' } });
    const paused = transitionJob(queued, 'Paused');
    const retrying = transitionJob(paused, 'Retrying');
    const replay = replayJob(retrying);

    await durableJobs.save(queued);
    await durableJobs.save(paused);
    await durableJobs.save(retrying);
    await durableJobs.save(replay);

    await expect(durableJobs.findById(queued.id)).resolves.toMatchObject({
      id: queued.id,
      status: 'Retrying',
      retryCount: 1,
      payload: { chapterId: 'chapter_abc' }
    });
    await expect(durableJobs.findReplayLineage(replay.id)).resolves.toEqual([queued.id, replay.id]);
    database.client.close();
  });
});
