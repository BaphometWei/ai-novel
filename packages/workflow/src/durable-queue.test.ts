import { describe, expect, it } from 'vitest';
import { createDurableJob } from './durable-job';
import {
  cancelJob,
  claimJob,
  completeJob,
  failJobForRetry,
  isCancellationRequested,
  requestJobCancellation,
  replayQueuedJob
} from './durable-queue';

describe('durable queue state machine', () => {
  it('claims queued jobs with a worker lease without losing payload', () => {
    const queued = createDurableJob({ workflowType: 'writing.run', payload: { projectId: 'project_1' } });

    const claimed = claimJob(queued, { workerId: 'worker_1', now: '2026-04-28T00:00:00.000Z', leaseMs: 30_000 });

    expect(claimed).toMatchObject({
      status: 'Running',
      payload: { projectId: 'project_1' },
      leaseOwner: 'worker_1',
      leaseExpiresAt: '2026-04-28T00:00:30.000Z'
    });
  });

  it('schedules retries with attempt metadata and last error while preserving original payload', () => {
    const claimed = claimJob(createDurableJob({ workflowType: 'writing.run', payload: { projectId: 'project_1' } }), {
      workerId: 'worker_1',
      now: '2026-04-28T00:00:00.000Z',
      leaseMs: 30_000
    });

    const retry = failJobForRetry(claimed, {
      error: 'transient timeout',
      now: '2026-04-28T00:00:01.000Z',
      delayMs: 60_000
    });

    expect(retry).toMatchObject({
      status: 'Retrying',
      retryCount: 1,
      availableAt: '2026-04-28T00:01:01.000Z',
      lastError: 'transient timeout',
      payload: { projectId: 'project_1', lastError: 'transient timeout' }
    });
    expect(retry.leaseOwner).toBeUndefined();
    expect(retry.leaseExpiresAt).toBeUndefined();
  });

  it('completes running jobs with output and clears lease metadata', () => {
    const claimed = claimJob(createDurableJob({ workflowType: 'writing.run', payload: { projectId: 'project_1' } }), {
      workerId: 'worker_1',
      now: '2026-04-28T00:00:00.000Z',
      leaseMs: 30_000
    });

    const completed = completeJob(claimed, { output: { ok: true } });

    expect(completed).toMatchObject({
      status: 'Succeeded',
      payload: { projectId: 'project_1', output: { ok: true } }
    });
    expect(completed.leaseOwner).toBeUndefined();
    expect(completed.leaseExpiresAt).toBeUndefined();
  });

  it('cancels jobs with a reason and exposes cancellation requests', () => {
    const claimed = claimJob(createDurableJob({ workflowType: 'writing.run', payload: { projectId: 'project_1' } }), {
      workerId: 'worker_1',
      now: '2026-04-28T00:00:00.000Z',
      leaseMs: 30_000
    });

    const requested = requestJobCancellation(claimed, {
      now: '2026-04-28T00:00:05.000Z',
      reason: 'operator'
    });
    const cancelled = cancelJob(requested, { reason: 'operator' });

    expect(isCancellationRequested(requested)).toBe(true);
    expect(cancelled).toMatchObject({
      status: 'Cancelled',
      cancelRequestedAt: '2026-04-28T00:00:05.000Z',
      payload: { projectId: 'project_1', cancelReason: 'operator' }
    });
    expect(cancelled.leaseOwner).toBeUndefined();
  });

  it('creates queued replay jobs that preserve payload and lineage', () => {
    const original = createDurableJob({ workflowType: 'writing.run', payload: { projectId: 'project_1', draftId: 'a' } });
    const succeeded = completeJob(claimJob(original, { workerId: 'worker_1', now: '2026-04-28T00:00:00.000Z', leaseMs: 1 }), {
      output: { ok: true }
    });

    const replay = replayQueuedJob(succeeded);

    expect(replay.id).not.toBe(succeeded.id);
    expect(replay).toMatchObject({
      workflowType: 'writing.run',
      status: 'Queued',
      retryCount: 0,
      replayOfJobId: original.id,
      payload: { projectId: 'project_1', draftId: 'a' }
    });
    expect(replay.leaseOwner).toBeUndefined();
    expect(replay.cancelRequestedAt).toBeUndefined();
  });
});
