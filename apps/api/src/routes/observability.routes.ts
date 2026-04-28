import {
  aggregateProductObservability,
  summarizeObservability,
  summarizeWorkflowBottlenecks,
  type ObservableAgentRun,
  type RunError,
  type WorkflowStepTelemetry
} from '@ai-novel/evaluation';
import type { AgentRun, LlmCallRecord } from '@ai-novel/domain';
import type { FastifyInstance } from 'fastify';
import type { AgentRunLookupStore, LlmCallLogStore } from './agent-runs.routes';
import type { DurableJob } from '@ai-novel/workflow';

export interface PersistedObservabilitySnapshot {
  id: string;
  projectId: string;
  windowStartAt: string;
  windowEndAt: string;
  capturedAt: string;
  cost: unknown;
  latency: unknown;
  tokens: unknown;
  quality: Record<string, unknown>;
  adoption: Record<string, unknown>;
  modelUsage: unknown[];
  runErrors: unknown[];
  workflowBottlenecks: unknown[];
  dataQuality: unknown;
  sourceRunIds: string[];
}

export interface ObservabilityRouteStores {
  agentRuns: AgentRunLookupStore;
  llmCallLogs: LlmCallLogStore;
  durableJobs?: {
    listDue?(now: string, limit?: number): Promise<DurableJob[]>;
  };
  approvals?: {
    listPendingApprovalRequests(): Promise<unknown[]>;
  };
  snapshots?: {
    getLatestByProject(projectId: string): Promise<PersistedObservabilitySnapshot | null>;
    listByProjectWindow?(
      projectId: string,
      window: { windowStartAt: string; windowEndAt: string }
    ): Promise<PersistedObservabilitySnapshot[]>;
  };
}

export function registerObservabilityRoutes(app: FastifyInstance, stores: ObservabilityRouteStores) {
  app.get('/observability/summary', async (_request, reply) => {
    return reply.send(await buildLiveSummary(stores));
  });

  app.get<{ Params: { projectId: string } }>('/projects/:projectId/observability/summary', async (request, reply) => {
    const snapshot = stores.snapshots ? await stores.snapshots.getLatestByProject(request.params.projectId) : null;
    if (snapshot) return reply.send(snapshotToSummary(snapshot));

    return reply.send({
      ...(await buildLiveSummary(stores)),
      projectId: request.params.projectId,
      snapshotId: null
    });
  });
}

async function buildLiveSummary(stores: ObservabilityRouteStores) {
    const agentRuns = await stores.agentRuns.list({ limit: 100 });
    const observableRuns = await Promise.all(agentRuns.map((run) => toObservableAgentRun(run, stores.llmCallLogs)));

    const base = aggregateProductObservability({ runs: observableRuns });
    const observed = summarizeObservability(observableRuns);
    const pendingApprovals = stores.approvals ? await stores.approvals.listPendingApprovalRequests() : [];

    return {
      ...base,
      quality: {
        ...base.quality,
        status: observableRuns.length > 0 ? 'Measured' : 'InsufficientData'
      },
      adoption: {
        ...base.adoption,
        status: observableRuns.length > 0 ? 'Measured' : 'InsufficientData'
      },
      modelUsage: observed.modelUsage,
      runErrors: observed.runErrors,
      workflowBottlenecks: summarizeWorkflowBottlenecks(toWorkflowTelemetry(await listDueJobs(stores))),
      dataQuality: {
        openIssueCount: pendingApprovals.length,
        highSeverityOpenCount: pendingApprovals.length
      }
    };
}

function snapshotToSummary(snapshot: PersistedObservabilitySnapshot) {
  return {
    projectId: snapshot.projectId,
    snapshotId: snapshot.id,
    windowStartAt: snapshot.windowStartAt,
    windowEndAt: snapshot.windowEndAt,
    capturedAt: snapshot.capturedAt,
    cost: snapshot.cost,
    latency: snapshot.latency,
    tokens: snapshot.tokens,
    quality: { ...snapshot.quality, status: 'Measured' },
    adoption: { ...snapshot.adoption, status: 'Measured' },
    modelUsage: snapshot.modelUsage,
    runErrors: snapshot.runErrors,
    workflowBottlenecks: snapshot.workflowBottlenecks,
    dataQuality: snapshot.dataQuality,
    sourceRunIds: snapshot.sourceRunIds
  };
}

async function listDueJobs(stores: ObservabilityRouteStores): Promise<DurableJob[]> {
  return stores.durableJobs?.listDue ? stores.durableJobs.listDue(new Date().toISOString(), 100) : [];
}

function toWorkflowTelemetry(jobs: DurableJob[]): WorkflowStepTelemetry[] {
  return jobs.map((job) => ({
    workflowType: job.workflowType,
    stepName: job.status,
    durationMs: 0,
    status: job.status === 'Failed' ? 'Failed' : 'Succeeded',
    retryCount: job.retryCount
  }));
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
