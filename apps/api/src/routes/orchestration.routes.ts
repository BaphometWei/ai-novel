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
  contextSections: z.array(
    z.object({
      name: z.string().min(1),
      content: z.string()
    })
  )
});

const orchestrationParamsSchema = z.object({
  id: z.string().min(1)
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid orchestration payload' });
}

export function registerOrchestrationRoutes(app: FastifyInstance, service: AgentOrchestrationService) {
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
      if (error instanceof AgentOrchestrationError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          orchestrationRunId: error.orchestrationRunId
        });
      }
      throw error;
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
