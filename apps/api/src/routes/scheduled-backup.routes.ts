import {
  advanceScheduledBackupAfterRun,
  createScheduledBackupJobIntents,
  type ScheduledBackupPolicy
} from '@ai-novel/workflow';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface ScheduledBackupRouteStore {
  upsert(policy: ScheduledBackupPolicy): Promise<void>;
  list(): Promise<ScheduledBackupPolicy[]>;
  findById(id: string): Promise<ScheduledBackupPolicy | null>;
  listDue(now: string): Promise<ScheduledBackupPolicy[]>;
  updateRunStatus(
    id: string,
    input: {
      lastRunAt: string;
      nextRunAt: string;
      lastRunStatus: NonNullable<ScheduledBackupPolicy['lastRunStatus']>;
    }
  ): Promise<void>;
}

const paramsSchema = z.object({
  id: z.string().min(1)
});

const isoDateSchema = z.string().datetime();

const policyPayloadSchema = z.object({
  projectId: z.string().min(1),
  cadence: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  targetPathPrefix: z.string().min(1),
  enabled: z.boolean(),
  lastRunAt: isoDateSchema.optional(),
  nextRunAt: isoDateSchema,
  retentionCount: z.number().int().positive(),
  lastRunStatus: z.enum(['Succeeded', 'Failed']).optional()
});

const dueQuerySchema = z.object({
  now: isoDateSchema
});

const runResultSchema = z.object({
  completedAt: isoDateSchema,
  status: z.enum(['Succeeded', 'Failed'])
});

class InMemoryScheduledBackupStore implements ScheduledBackupRouteStore {
  private readonly policies = new Map<string, ScheduledBackupPolicy>();

  async upsert(policy: ScheduledBackupPolicy): Promise<void> {
    this.policies.set(policy.id, policy);
  }

  async list(): Promise<ScheduledBackupPolicy[]> {
    return [...this.policies.values()];
  }

  async findById(id: string): Promise<ScheduledBackupPolicy | null> {
    return this.policies.get(id) ?? null;
  }

  async listDue(now: string): Promise<ScheduledBackupPolicy[]> {
    const nowTime = Date.parse(now);
    return [...this.policies.values()].filter((policy) => policy.enabled && Date.parse(policy.nextRunAt) <= nowTime);
  }

  async updateRunStatus(
    id: string,
    input: {
      lastRunAt: string;
      nextRunAt: string;
      lastRunStatus: NonNullable<ScheduledBackupPolicy['lastRunStatus']>;
    }
  ): Promise<void> {
    const policy = this.policies.get(id);
    if (!policy) return;
    this.policies.set(id, { ...policy, ...input });
  }
}

export function createInMemoryScheduledBackupStore(): ScheduledBackupRouteStore {
  return new InMemoryScheduledBackupStore();
}

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid scheduled backup payload' });
}

export function registerScheduledBackupRoutes(app: FastifyInstance, store: ScheduledBackupRouteStore) {
  app.put('/scheduled-backups/policies/:id', async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const parsed = policyPayloadSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const policy = { id: params.id, ...parsed.data };
    await store.upsert(policy);
    return reply.send(policy);
  });

  app.get('/scheduled-backups/policies', async () => store.list());

  app.get('/scheduled-backups/due', async (request, reply) => {
    const parsed = dueQuerySchema.safeParse(request.query);
    if (!parsed.success) return invalidPayload(reply);

    const policies = await store.listDue(parsed.data.now);
    return reply.send({
      policies,
      intents: createScheduledBackupJobIntents(policies, parsed.data.now)
    });
  });

  app.post('/scheduled-backups/policies/:id/runs', async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const parsed = runResultSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const policy = await store.findById(params.id);
    if (!policy) return reply.code(404).send({ error: 'Scheduled backup policy not found' });

    const updated = advanceScheduledBackupAfterRun(policy, parsed.data);
    await store.updateRunStatus(params.id, {
      lastRunAt: parsed.data.completedAt,
      nextRunAt: updated.nextRunAt,
      lastRunStatus: parsed.data.status
    });
    return reply.send(updated);
  });
}
