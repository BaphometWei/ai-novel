import { createDurableJob, type DurableJob } from './durable-job';

export interface ClaimJobInput {
  workerId: string;
  now: string;
  leaseMs: number;
}

export interface RetryJobInput {
  error: string;
  now: string;
  delayMs: number;
}

export interface CompleteJobInput {
  output: Record<string, unknown>;
}

export interface CancelJobInput {
  reason: string;
}

export interface RequestJobCancellationInput {
  now: string;
  reason?: string;
}

export function claimJob(job: DurableJob, input: ClaimJobInput): DurableJob {
  if (!isClaimable(job, input.now)) {
    throw new Error(`Job ${job.id} is not claimable from status ${job.status}`);
  }

  return {
    ...job,
    status: 'Running',
    leaseOwner: input.workerId,
    leaseExpiresAt: addMilliseconds(input.now, input.leaseMs)
  };
}

export function failJobForRetry(job: DurableJob, input: RetryJobInput): DurableJob {
  return {
    ...job,
    status: 'Retrying',
    retryCount: job.retryCount + 1,
    availableAt: addMilliseconds(input.now, input.delayMs),
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    lastError: input.error,
    payload: {
      ...job.payload,
      lastError: input.error
    }
  };
}

export function completeJob(job: DurableJob, input: CompleteJobInput): DurableJob {
  return {
    ...job,
    status: 'Succeeded',
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    payload: {
      ...job.payload,
      output: input.output
    }
  };
}

export function cancelJob(job: DurableJob, input: CancelJobInput): DurableJob {
  return {
    ...job,
    status: 'Cancelled',
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    payload: {
      ...job.payload,
      cancelReason: input.reason
    }
  };
}

export function requestJobCancellation(job: DurableJob, input: RequestJobCancellationInput): DurableJob {
  return {
    ...job,
    cancelRequestedAt: input.now,
    payload: input.reason
      ? {
          ...job.payload,
          cancelReason: input.reason
        }
      : job.payload
  };
}

export function isCancellationRequested(job: DurableJob): boolean {
  return Boolean(job.cancelRequestedAt);
}

export function replayQueuedJob(job: DurableJob): DurableJob {
  return {
    ...createDurableJob({
      workflowType: job.workflowType,
      payload: withoutExecutionPayload(job.payload)
    }),
    replayOfJobId: job.replayOfJobId ?? job.id
  };
}

function isClaimable(job: DurableJob, now: string): boolean {
  if (job.leaseExpiresAt && job.leaseExpiresAt > now) return false;
  if (job.status === 'Queued') return isDue(job, now);
  if (job.status === 'Retrying') return isDue(job, now);
  if (job.status !== 'Running' || !job.leaseExpiresAt) return false;
  return job.leaseExpiresAt <= now;
}

function isDue(job: DurableJob, now: string): boolean {
  return !job.availableAt || job.availableAt <= now;
}

function addMilliseconds(iso: string, milliseconds: number): string {
  return new Date(new Date(iso).getTime() + milliseconds).toISOString();
}

function withoutExecutionPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { cancelReason: _cancelReason, lastError: _lastError, output: _output, ...rest } = payload;
  return rest;
}
