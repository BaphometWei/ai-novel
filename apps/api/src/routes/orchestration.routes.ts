import type { EntityId, RiskLevel } from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AgentOrchestrationError, type AgentOrchestrationService } from '../services/agent-orchestration.service';

const orchestrationBodySchema = z.object({
  projectId: z.custom<EntityId<'project'>>(
    (value) => typeof value === 'string' && value.startsWith('project_'),
    'projectId must start with project_'
  ),
  workflowType: z.string().min(1),
  taskType: z.string().min(1),
  agentRole: z.string().min(1),
  taskGoal: z.string().min(1),
  riskLevel: z.enum(['Low', 'Medium', 'High', 'Blocking']),
  outputSchema: z.string().min(1),
  promptVersionId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  retrieval: z
    .object({
      query: z.string().min(1),
      maxContextItems: z.number().int().positive().optional(),
      maxSectionChars: z.number().int().positive().optional()
    })
    .optional(),
  contextSections: z.array(
    z.object({
      name: z.string().min(1),
      content: z.string()
    })
  ).optional()
});

const orchestrationParamsSchema = z.object({
  id: z.string().min(1)
});

const preparedOrchestrationParamsSchema = z.object({
  preparedRunId: z.string().min(1)
});

const executePreparedSchema = z.object({
  confirmed: z.boolean(),
  confirmedBy: z.string().min(1).optional()
});

const cancelPreparedSchema = z.object({
  cancelledBy: z.string().min(1).optional()
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid orchestration payload' });
}

export function registerOrchestrationRoutes(app: FastifyInstance, service: AgentOrchestrationService) {
  app.post('/orchestration/runs/prepare', async (request, reply) => {
    const parsed = orchestrationBodySchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    try {
      const result = await service.prepare({
        ...parsed.data,
        riskLevel: parsed.data.riskLevel as RiskLevel
      });
      return reply.code(201).send(result);
    } catch (error) {
      return sendOrchestrationError(reply, error);
    }
  });

  app.post('/orchestration/runs/:preparedRunId/execute', async (request, reply) => {
    const params = preparedOrchestrationParamsSchema.safeParse(request.params);
    const parsed = executePreparedSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    try {
      const result = await service.executePrepared(params.data.preparedRunId, parsed.data);
      return reply.code(201).send(result);
    } catch (error) {
      return sendOrchestrationError(reply, error);
    }
  });

  app.post('/orchestration/runs/:preparedRunId/cancel', async (request, reply) => {
    const params = preparedOrchestrationParamsSchema.safeParse(request.params);
    const parsed = cancelPreparedSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    try {
      return reply.code(200).send(await service.cancelPrepared(params.data.preparedRunId, parsed.data));
    } catch (error) {
      return sendOrchestrationError(reply, error);
    }
  });

  app.post('/orchestration/runs', async (request, reply) => {
    const parsed = orchestrationBodySchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    try {
      const result = await service.start({
        ...parsed.data,
        riskLevel: parsed.data.riskLevel as RiskLevel
      });
      return reply.code(201).send(result);
    } catch (error) {
      return sendOrchestrationError(reply, error);
    }
  });

  app.get('/orchestration/runs/:id', async (request, reply) => {
    const params = orchestrationParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const result = await service.findById(params.data.id);
    if (!result) return reply.code(404).send({ error: 'Orchestration run not found' });
    return reply.send(result);
  });
}

function sendOrchestrationError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof AgentOrchestrationError)) throw error;
  return reply.code(error.statusCode).send({
    error: error.message,
    ...(error.message === 'Pre-send inspection is required for external orchestration runs'
      ? { requiresInspection: true }
      : {}),
    ...(error.orchestrationRunId ? { orchestrationRunId: error.orchestrationRunId } : {})
  });
}
