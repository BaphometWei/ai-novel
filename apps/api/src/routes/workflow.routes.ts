import {
  createDurableJob,
  createTaskContract,
  replayJob,
  transitionJob,
  type DurableJob,
  type DurableJobStatus,
  type WorkflowRun,
  WorkflowRunner
} from '@ai-novel/workflow';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { DurableWorkerService } from '../services/durable-worker.service';

export interface WorkflowRunStore {
  save(run: WorkflowRun): Promise<void>;
  findById(id: string): Promise<WorkflowRun | null>;
}

export interface DurableJobStore {
  save(job: DurableJob): Promise<void>;
  findById(id: string): Promise<DurableJob | null>;
  findReplayLineage(id: string): Promise<string[]>;
}

export interface WorkflowRouteStores {
  workflowRuns: WorkflowRunStore;
  durableJobs: DurableJobStore;
  worker?: DurableWorkerService;
}

const runStepSchema = z.object({
  name: z.string().min(1),
  artifactIds: z.array(z.string().min(1)),
  status: z.enum(['Queued', 'Running', 'Succeeded', 'Failed']),
  error: z.string().min(1).optional(),
  retryAttempt: z.number().int().nonnegative().optional()
});

const taskContractSchema = z.object({
  projectId: z.custom<`project_${string}`>(
    (value) => typeof value === 'string' && value.startsWith('project_'),
    'projectId must start with project_'
  ),
  taskType: z.string().min(1),
  agentRole: z.string().min(1),
  riskLevel: z.enum(['Low', 'Medium', 'High']),
  outputSchema: z.string().min(1)
});

const createWorkflowRunSchema = z.object({
  taskContract: taskContractSchema,
  steps: z.array(runStepSchema)
});

const createDurableJobSchema = z.object({
  workflowType: z.string().min(1),
  payload: z.record(z.unknown())
});

const durableJobStatusSchema = z.object({
  status: z.enum(['Queued', 'Running', 'Paused', 'Retrying', 'Succeeded', 'Failed', 'Cancelled'])
});

const cancelJobSchema = z.object({
  reason: z.string().min(1).optional()
});

class InMemoryWorkflowRunStore implements WorkflowRunStore {
  private readonly runs = new Map<string, WorkflowRun>();

  async save(run: WorkflowRun): Promise<void> {
    this.runs.set(run.id, run);
  }

  async findById(id: string): Promise<WorkflowRun | null> {
    return this.runs.get(id) ?? null;
  }
}

class InMemoryDurableJobStore implements DurableJobStore {
  private readonly jobs = new Map<string, DurableJob>();

  async save(job: DurableJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async findById(id: string): Promise<DurableJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async findReplayLineage(id: string): Promise<string[]> {
    const lineage: string[] = [];
    let current = await this.findById(id);
    while (current) {
      lineage.unshift(current.id);
      current = current.replayOfJobId ? await this.findById(current.replayOfJobId) : null;
    }
    return lineage;
  }
}

export function createInMemoryWorkflowStores(): WorkflowRouteStores {
  return {
    workflowRuns: new InMemoryWorkflowRunStore(),
    durableJobs: new InMemoryDurableJobStore()
  };
}

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid workflow payload' });
}

export function registerWorkflowRoutes(app: FastifyInstance, stores: WorkflowRouteStores = createInMemoryWorkflowStores()) {
  const runner = new WorkflowRunner();

  app.post('/workflow/runs', async (request, reply) => {
    const parsed = createWorkflowRunSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const run = await runner.run(createTaskContract(parsed.data.taskContract), parsed.data.steps);
    await stores.workflowRuns.save(run);
    return reply.code(201).send(run);
  });

  app.get('/workflow/runs/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const run = await stores.workflowRuns.findById(params.id);
    if (!run) return reply.code(404).send({ error: 'Workflow run not found' });
    return reply.send(run);
  });

  app.post('/workflow/runs/:id/steps', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const parsed = runStepSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const run = await stores.workflowRuns.findById(params.id);
    if (!run) return reply.code(404).send({ error: 'Workflow run not found' });

    const resumed = runner.resume(run, parsed.data);
    await stores.workflowRuns.save(resumed);
    return reply.send(resumed);
  });

  app.post('/workflow/jobs', async (request, reply) => {
    const parsed = createDurableJobSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const job = createDurableJob(parsed.data);
    await stores.durableJobs.save(job);
    return reply.code(201).send(job);
  });

  app.get('/workflow/jobs/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const job = await stores.durableJobs.findById(params.id);
    if (!job) return reply.code(404).send({ error: 'Durable job not found' });
    return reply.send(job);
  });

  app.patch('/workflow/jobs/:id/status', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const parsed = durableJobStatusSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const job = await stores.durableJobs.findById(params.id);
    if (!job) return reply.code(404).send({ error: 'Durable job not found' });

    const updated = transitionJob(job, parsed.data.status as DurableJobStatus);
    await stores.durableJobs.save(updated);
    return reply.send(updated);
  });

  app.post('/workflow/jobs/:id/replay', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const job = await stores.durableJobs.findById(params.id);
    if (!job) return reply.code(404).send({ error: 'Durable job not found' });

    const replay = stores.worker ? await stores.worker.replay(params.id) : replayJob(job);
    if (!replay) return reply.code(404).send({ error: 'Durable job not found' });
    await stores.durableJobs.save(replay);
    return reply.code(201).send(replay);
  });

  app.post('/workflow/jobs/:id/cancel', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const parsed = cancelJobSchema.safeParse(request.body ?? {});
    if (!parsed.success) return invalidPayload(reply);
    if (!stores.worker) return reply.code(409).send({ error: 'Workflow worker is not configured' });

    const job = await stores.worker.cancel(params.id, parsed.data.reason);
    if (!job) return reply.code(404).send({ error: 'Durable job not found' });
    return reply.send(job);
  });

  app.post('/workflow/worker/run-once', async (_request, reply) => {
    if (!stores.worker) return reply.code(409).send({ error: 'Workflow worker is not configured' });
    return reply.send(await stores.worker.runOnce());
  });

  app.get('/workflow/jobs/:id/replay-lineage', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const job = await stores.durableJobs.findById(params.id);
    if (!job) return reply.code(404).send({ error: 'Durable job not found' });

    return reply.send({ jobIds: await stores.durableJobs.findReplayLineage(params.id) });
  });
}
