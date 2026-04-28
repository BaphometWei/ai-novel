import {
  cancelJob,
  completeJob,
  failJobForRetry,
  replayQueuedJob,
  type DurableJob
} from '@ai-novel/workflow';

export interface DurableWorkerJobStore {
  save(job: DurableJob): Promise<void>;
  findById(id: string): Promise<DurableJob | null>;
  claimNext(input: {
    workflowTypes?: string[];
    workerId: string;
    now: string;
    leaseMs: number;
  }): Promise<DurableJob | null>;
  markCancelRequested(id: string, input: { now: string; reason?: string }): Promise<DurableJob | null>;
}

export interface DurableJobHandler {
  workflowType: string;
  run(
    job: DurableJob,
    signal: { isCancellationRequested(): Promise<boolean> }
  ): Promise<Record<string, unknown>>;
}

export interface DurableWorkerService {
  runOnce(input?: { workerId?: string; now?: string }): Promise<{ claimed: number; completed: number; failed: number }>;
  replay(id: string): Promise<DurableJob | null>;
  cancel(id: string, reason?: string): Promise<DurableJob | null>;
}

export function createDurableWorkerService(input: {
  durableJobs: DurableWorkerJobStore;
  handlers: DurableJobHandler[];
  clock?: () => string;
  leaseMs?: number;
  retryDelayMs?: number;
}): DurableWorkerService {
  const clock = input.clock ?? (() => new Date().toISOString());
  const handlerByType = new Map(input.handlers.map((handler) => [handler.workflowType, handler]));

  return {
    async runOnce(runInput = {}) {
      const now = runInput.now ?? clock();
      const job = await input.durableJobs.claimNext({
        workflowTypes: [...handlerByType.keys()],
        workerId: runInput.workerId ?? 'local-worker',
        now,
        leaseMs: input.leaseMs ?? 30_000
      });
      if (!job) return { claimed: 0, completed: 0, failed: 0 };

      const handler = handlerByType.get(job.workflowType);
      if (!handler) {
        await input.durableJobs.save(
          failJobForRetry(job, {
            error: `Unsupported workflow type: ${job.workflowType}`,
            now,
            delayMs: input.retryDelayMs ?? 60_000
          })
        );
        return { claimed: 1, completed: 0, failed: 1 };
      }

      try {
        const output = await handler.run(job, {
          async isCancellationRequested() {
            const current = await input.durableJobs.findById(job.id);
            return Boolean(current?.cancelRequestedAt);
          }
        });
        const current = await input.durableJobs.findById(job.id);
        if (current?.cancelRequestedAt) {
          await input.durableJobs.save(cancelJob(current, { reason: String(current.payload.cancelReason ?? 'cancelled') }));
          return { claimed: 1, completed: 0, failed: 0 };
        }
        await input.durableJobs.save(completeJob(job, { output }));
        return { claimed: 1, completed: 1, failed: 0 };
      } catch (error) {
        await input.durableJobs.save(
          failJobForRetry(job, {
            error: error instanceof Error ? error.message : 'Durable job failed',
            now,
            delayMs: input.retryDelayMs ?? 60_000
          })
        );
        return { claimed: 1, completed: 0, failed: 1 };
      }
    },
    async replay(id) {
      const job = await input.durableJobs.findById(id);
      if (!job) return null;

      const replay = replayQueuedJob(job);
      await input.durableJobs.save(replay);
      return replay;
    },
    cancel(id, reason) {
      return input.durableJobs.markCancelRequested(id, { now: clock(), reason });
    }
  };
}
