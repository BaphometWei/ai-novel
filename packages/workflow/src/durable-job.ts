import { createId } from '@ai-novel/domain';

export type DurableJobStatus = 'Queued' | 'Running' | 'Paused' | 'Retrying' | 'Succeeded' | 'Failed' | 'Cancelled';

export interface DurableJob {
  id: string;
  workflowType: string;
  payload: Record<string, unknown>;
  status: DurableJobStatus;
  retryCount: number;
  replayOfJobId?: string;
  availableAt?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  cancelRequestedAt?: string;
  lastError?: string;
}

export function createDurableJob(input: {
  workflowType: string;
  payload: Record<string, unknown>;
  availableAt?: string;
}): DurableJob {
  return {
    id: `job_${createId('agent_run').slice('agent_run_'.length)}`,
    status: 'Queued',
    retryCount: 0,
    ...input
  };
}

export function transitionJob(job: DurableJob, status: DurableJobStatus): DurableJob {
  return {
    ...job,
    status,
    retryCount: status === 'Retrying' ? job.retryCount + 1 : job.retryCount,
    leaseOwner: terminalStatuses.has(status) ? undefined : job.leaseOwner,
    leaseExpiresAt: terminalStatuses.has(status) ? undefined : job.leaseExpiresAt
  };
}

export function replayJob(job: DurableJob): DurableJob {
  return {
    ...job,
    id: `job_${createId('agent_run').slice('agent_run_'.length)}`,
    status: 'Queued',
    retryCount: 0,
    replayOfJobId: job.replayOfJobId ?? job.id,
    availableAt: undefined,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    cancelRequestedAt: undefined,
    lastError: undefined
  };
}

const terminalStatuses = new Set<DurableJobStatus>(['Succeeded', 'Failed', 'Cancelled']);
