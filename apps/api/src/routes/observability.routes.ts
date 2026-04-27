import { aggregateProductObservability, type ObservableAgentRun, type RunError } from '@ai-novel/evaluation';
import type { AgentRun, LlmCallRecord } from '@ai-novel/domain';
import type { FastifyInstance } from 'fastify';
import type { AgentRunLookupStore, LlmCallLogStore } from './agent-runs.routes';

export interface ObservabilityRouteStores {
  agentRuns: AgentRunLookupStore;
  llmCallLogs: LlmCallLogStore;
}

export function registerObservabilityRoutes(app: FastifyInstance, stores: ObservabilityRouteStores) {
  app.get('/observability/summary', async (_request, reply) => {
    const agentRuns = await stores.agentRuns.list({ limit: 100 });
    const observableRuns = await Promise.all(agentRuns.map((run) => toObservableAgentRun(run, stores.llmCallLogs)));

    return reply.send(
      aggregateProductObservability({
        runs: observableRuns
      })
    );
  });
}

async function toObservableAgentRun(run: AgentRun, llmCallLogs: LlmCallLogStore): Promise<ObservableAgentRun> {
  const calls = await llmCallLogs.findByAgentRunId(run.id);
  const latestCall = calls.at(-1);
  return {
    id: run.id,
    modelProvider: latestCall?.provider ?? 'unknown',
    modelName: latestCall?.model ?? 'unknown',
    costUsd: sum(calls.map((call) => call.estimatedCostUsd)),
    tokens: {
      input: sum(calls.map((call) => call.usage.inputTokens)),
      output: sum(calls.map((call) => call.usage.outputTokens))
    },
    durationMs: sum(calls.map((call) => call.durationMs)),
    retryCount: sum(calls.map((call) => call.retryCount)),
    contextLength: sum(calls.map((call) => call.usage.inputTokens)),
    status: run.status === 'Failed' ? 'Failed' : 'Succeeded',
    qualityOutcome: run.status === 'Failed' ? 'needs_revision' : 'accepted',
    userAdoption: run.status === 'Failed' ? 'rejected' : 'adopted',
    errors: calls.flatMap(toRunErrors)
  };
}

function toRunErrors(call: LlmCallRecord): RunError[] {
  if (!call.error) return [];
  return [
    {
      id: `${call.id}_error`,
      code: call.error,
      message: call.error,
      severity: 'Error',
      retryable: call.retryCount > 0,
      occurredAt: call.createdAt
    }
  ];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
