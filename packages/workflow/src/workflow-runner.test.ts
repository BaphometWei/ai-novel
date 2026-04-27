import { describe, expect, it } from 'vitest';
import { createDurableJob, replayJob, transitionJob } from './durable-job';
import { createTaskContract } from './task-contract';
import { WorkflowRunner } from './workflow-runner';

describe('workflow runtime', () => {
  it('records ordered run steps, artifacts, retry attempts, and failures', async () => {
    const runner = new WorkflowRunner();
    const contract = createTaskContract({
      projectId: 'project_abc',
      taskType: 'chapter_planning',
      agentRole: 'Planner Agent',
      riskLevel: 'Medium',
      outputSchema: 'ChapterPlan'
    });

    const run = await runner.run(contract, [
      { name: 'build_context', artifactIds: ['artifact_context'], status: 'Succeeded' },
      { name: 'generate_plan', artifactIds: ['artifact_plan'], status: 'Failed', error: 'schema mismatch' }
    ]);

    expect(run.steps.map((step) => step.order)).toEqual([1, 2]);
    expect(run.steps[1]).toMatchObject({ retryAttempt: 0, error: 'schema mismatch' });
  });

  it('pauses resumes cancels retries and replays durable jobs', () => {
    const queued = createDurableJob({ workflowType: 'deep_review', payload: { chapterId: 'chapter_abc' } });
    const paused = transitionJob(queued, 'Paused');
    const running = transitionJob(paused, 'Running');
    const retrying = transitionJob(running, 'Retrying');
    const replay = replayJob(retrying);
    const cancelled = transitionJob(replay, 'Cancelled');

    expect(paused.status).toBe('Paused');
    expect(running.status).toBe('Running');
    expect(retrying.retryCount).toBe(1);
    expect(replay.replayOfJobId).toBe(queued.id);
    expect(cancelled.status).toBe('Cancelled');
  });
});
