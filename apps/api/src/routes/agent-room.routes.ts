import {
  buildAgentRoomRunDetail,
  listAgentRoomRuns,
  runAgentRoomAction,
  type AgentRoomActionRepositories,
  type AgentRoomAllowedAction,
  type AgentRoomRepositories
} from '@ai-novel/workflow';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const runParamsSchema = z.object({
  id: z.string().min(1)
});

const actionParamsSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['cancel', 'retry', 'replay'])
});

export function registerAgentRoomRoutes(app: FastifyInstance, repositories: AgentRoomRepositories) {
  app.get('/agent-room/runs', async (_request, reply) => {
    return reply.send(await listAgentRoomRuns(repositories));
  });

  app.get('/agent-room/runs/:id', async (request, reply) => {
    const params = runParamsSchema.parse(request.params);
    const detail = await buildAgentRoomRunDetail(repositories, params.id);
    if (!detail) return reply.code(404).send({ error: 'Agent room run not found' });

    return reply.send(detail);
  });

  app.post('/agent-room/runs/:id/actions/:action', async (request, reply) => {
    const params = actionParamsSchema.parse(request.params);
    if (!canRunAgentRoomActions(repositories)) {
      return reply.code(503).send({ error: 'Agent room actions are not configured' });
    }

    try {
      const result = await runAgentRoomAction(repositories, params.id, params.action as AgentRoomAllowedAction);
      return reply.send({
        runId: result.runId,
        action: result.action,
        status: result.runStatus,
        jobId: result.jobId,
        jobStatus: result.jobStatus
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to run Agent Room action';
      if (message.includes('not found')) return reply.code(404).send({ error: message });
      if (message.includes('not allowed')) return reply.code(409).send({ error: message });
      return reply.code(500).send({ error: message });
    }
  });
}

function canRunAgentRoomActions(repositories: AgentRoomRepositories): repositories is AgentRoomActionRepositories {
  return (
    typeof (repositories.agentRuns as { save?: unknown }).save === 'function' &&
    typeof (repositories.durableJobs as { save?: unknown } | undefined)?.save === 'function'
  );
}
