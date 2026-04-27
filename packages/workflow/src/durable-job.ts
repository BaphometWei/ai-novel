import { createId } from '@ai-novel/domain';

export type DurableJobStatus = 'Queued' | 'Running' | 'Paused' | 'Retrying' | 'Succeeded' | 'Failed' | 'Cancelled';

export interface DurableJob {
  id: string;
  workflowType: string;
  payload: Record<string, unknown>;
  status: DurableJobStatus;
  retryCount: number;
  replayOfJobId?: string;
}

export function createDurableJob(input: { workflowType: string; payload: Record<string, unknown> }): DurableJob {
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
    retryCount: status === 'Retrying' ? job.retryCount + 1 : job.retryCount
  };
}

export function replayJob(job: DurableJob): DurableJob {
  return {
    ...job,
    id: `job_${createId('agent_run').slice('agent_run_'.length)}`,
    status: 'Queued',
    replayOfJobId: job.replayOfJobId ?? job.id
  };
}
