import { createLlmCallRecord, type AgentRun, type ContextPack, type EntityId, type LlmCallRecord } from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface LlmCallLogStore {
  save(record: LlmCallRecord): Promise<void>;
  findByAgentRunId(agentRunId: EntityId<'agent_run'>): Promise<LlmCallRecord[]>;
}

export interface AgentRunLookupStore {
  findById(id: EntityId<'agent_run'>): Promise<AgentRun | null>;
  list(filters: {
    workflowType?: AgentRun['workflowType'];
    taskType?: AgentRun['taskType'];
    status?: AgentRun['status'];
    limit?: number;
  }): Promise<AgentRun[]>;
}

export interface ContextPackLookupStore {
  findById(id: EntityId<'context_pack'>): Promise<ContextPack | null>;
}

export interface AgentRunRouteStores {
  agentRuns: AgentRunLookupStore;
  llmCallLogs: LlmCallLogStore;
  contextPacks?: ContextPackLookupStore;
}

const agentRunParamsSchema = z.object({
  id: z.custom<EntityId<'agent_run'>>(
    (value) => typeof value === 'string' && value.startsWith('agent_run_'),
    'id must start with agent_run_'
  )
});

const agentRunListQuerySchema = z.object({
  workflowType: z.string().min(1).optional(),
  taskType: z.string().min(1).optional(),
  status: z.enum(['Queued', 'Running', 'Succeeded', 'Failed', 'Cancelled']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const llmCallLogInputSchema = z.object({
  promptVersionId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  schemaName: z.string().min(1).optional(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative()
  }),
  durationMs: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  retryCount: z.number().int().nonnegative(),
  status: z.enum(['Succeeded', 'Failed']),
  error: z.string().min(1).optional()
});

class InMemoryLlmCallLogStore implements LlmCallLogStore {
  private readonly records = new Map<EntityId<'agent_run'>, LlmCallRecord[]>();

  async save(record: LlmCallRecord): Promise<void> {
    this.records.set(record.agentRunId, [...(this.records.get(record.agentRunId) ?? []), record]);
  }

  async findByAgentRunId(agentRunId: EntityId<'agent_run'>): Promise<LlmCallRecord[]> {
    return this.records.get(agentRunId) ?? [];
  }
}

class InMemoryAgentRunLookupStore implements AgentRunLookupStore {
  async findById(_id: EntityId<'agent_run'>): Promise<AgentRun | null> {
    return null;
  }

  async list(): Promise<AgentRun[]> {
    return [];
  }
}

export function createInMemoryAgentRunStores(): AgentRunRouteStores {
  return {
    agentRuns: new InMemoryAgentRunLookupStore(),
    llmCallLogs: new InMemoryLlmCallLogStore()
  };
}

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid agent run payload' });
}

export function registerAgentRunRoutes(app: FastifyInstance, stores: AgentRunRouteStores = createInMemoryAgentRunStores()) {
  app.get('/agent-runs', async (request, reply) => {
    const query = agentRunListQuerySchema.safeParse(request.query);
    if (!query.success) return invalidPayload(reply);

    return reply.send(await stores.agentRuns.list(query.data));
  });

  app.get('/agent-runs/:id', async (request, reply) => {
    const params = agentRunParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const agentRun = await stores.agentRuns.findById(params.data.id);
    if (!agentRun) return reply.code(404).send({ error: 'Agent run not found' });

    return reply.send(agentRun);
  });

  app.get('/agent-runs/:id/context-pack', async (request, reply) => {
    const params = agentRunParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const agentRun = await stores.agentRuns.findById(params.data.id);
    if (!agentRun) return reply.code(404).send({ error: 'Agent run not found' });
    if (!stores.contextPacks) return reply.code(503).send({ error: 'Context pack store not configured' });

    const contextPack = await stores.contextPacks.findById(agentRun.contextPackId);
    if (!contextPack) return reply.code(404).send({ error: 'Context pack not found' });

    return reply.send(contextPack);
  });

  app.post('/agent-runs/:id/llm-calls', async (request, reply) => {
    const params = agentRunParamsSchema.safeParse(request.params);
    const parsed = llmCallLogInputSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    const agentRun = await stores.agentRuns.findById(params.data.id);
    if (!agentRun) return reply.code(404).send({ error: 'Agent run not found' });

    const record = createLlmCallRecord({
      agentRunId: params.data.id,
      ...parsed.data
    });
    await stores.llmCallLogs.save(record);
    return reply.code(201).send(record);
  });

  app.get('/agent-runs/:id/llm-calls', async (request, reply) => {
    const params = agentRunParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const agentRun = await stores.agentRuns.findById(params.data.id);
    if (!agentRun) return reply.code(404).send({ error: 'Agent run not found' });

    return reply.send(await stores.llmCallLogs.findByAgentRunId(params.data.id));
  });
}
