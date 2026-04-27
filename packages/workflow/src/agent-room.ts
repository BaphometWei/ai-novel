import type { AgentRun, AgentRunStatus, ArtifactRecord, ContextPack, LlmCallRecord } from '@ai-novel/domain';
import { replayJob, transitionJob, type DurableJob, type DurableJobStatus } from './durable-job';
import type { WorkflowRun } from './workflow-runner';

export type AgentRoomAllowedAction = 'cancel' | 'retry' | 'replay';

export interface AgentRoomApproval {
  id: string;
  runId?: string;
  title?: string;
  riskLevel?: string;
  status: string;
  createdAt?: string;
}

export interface AgentRoomRepositories {
  agentRuns: {
    list(): Promise<AgentRun[]> | AgentRun[];
    getById(id: string): Promise<AgentRun | null> | AgentRun | null;
  };
  workflowRuns: {
    getByAgentRunId(agentRunId: string): Promise<WorkflowRun | null> | WorkflowRun | null;
  };
  contextPacks: {
    getById(id: string): Promise<ContextPack | null> | ContextPack | null;
  };
  artifacts: {
    listByRunId(agentRunId: string): Promise<ArtifactRecord[]> | ArtifactRecord[];
  };
  llmCallLogs: {
    listByRunId(agentRunId: string): Promise<LlmCallRecord[]> | LlmCallRecord[];
  };
  approvals?: {
    listByRunId(agentRunId: string): Promise<AgentRoomApproval[]> | AgentRoomApproval[];
  };
  durableJobs?: {
    getByAgentRunId(agentRunId: string): Promise<DurableJob | null> | DurableJob | null;
    findReplayLineage?(jobId: string): Promise<string[]> | string[];
  };
}

export interface AgentRoomActionRepositories extends Omit<AgentRoomRepositories, 'agentRuns' | 'durableJobs'> {
  agentRuns: AgentRoomRepositories['agentRuns'] & {
    save(agentRun: AgentRun): Promise<void> | void;
  };
  durableJobs: NonNullable<AgentRoomRepositories['durableJobs']> & {
    save(job: DurableJob): Promise<void> | void;
  };
}

export interface AgentRoomActionResult {
  action: AgentRoomAllowedAction;
  runId: string;
  runStatus: AgentRunStatus;
  jobId: string;
  jobStatus: DurableJobStatus;
}

export interface AgentRoomRunListItem {
  id: string;
  agentName: string;
  taskType: string;
  workflowType: string;
  promptVersionId: string;
  status: AgentRunStatus;
  jobStatus?: DurableJobStatus;
  createdAt: string;
  totalCostUsd: number;
  pendingApprovalCount: number;
  allowedActions: AgentRoomAllowedAction[];
}

export interface AgentRoomGraphStep {
  id: string;
  order: number;
  name: string;
  status: string;
  artifactIds: string[];
  retryAttempt: number;
  error?: string;
}

export interface AgentRoomContextPackView {
  id: string;
  artifactId?: string;
  taskGoal: string;
  agentRole: string;
  riskLevel: string;
  sections: ContextPack['sections'];
  citations: ContextPack['citations'];
  exclusions: string[];
  warnings: string[];
  retrievalTrace: string[];
  createdAt: string;
}

export interface AgentRoomArtifactView {
  id: string;
  type: ArtifactRecord['type'];
  source: ArtifactRecord['source'];
  version: number;
  hash: string;
  uri: string;
  relatedRunId?: string;
  createdAt: string;
}

export interface AgentRoomCostCall {
  id: string;
  promptVersionId: string;
  provider: string;
  model: string;
  schemaName?: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  estimatedCostUsd: number;
  retryCount: number;
  status: LlmCallRecord['status'];
  error?: string;
  createdAt: string;
}

export interface AgentRoomCostSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  calls: AgentRoomCostCall[];
}

export interface AgentRoomDurableJobView {
  id: string;
  workflowType: string;
  status: DurableJobStatus;
  retryCount: number;
  replayOfJobId?: string;
  lineage: string[];
}

export interface AgentRoomRunDetail {
  run: AgentRoomRunListItem & {
    contextPackId: string;
  };
  workflowRun: WorkflowRun | null;
  graph: AgentRoomGraphStep[];
  contextPack: AgentRoomContextPackView | null;
  artifacts: AgentRoomArtifactView[];
  approvals: AgentRoomApproval[];
  durableJob: AgentRoomDurableJobView | null;
  costSummary: AgentRoomCostSummary;
}

export async function listAgentRoomRuns(repositories: AgentRoomRepositories): Promise<AgentRoomRunListItem[]> {
  const runs = await repositories.agentRuns.list();
  return Promise.all(runs.map((run) => buildRunListItem(repositories, run)));
}

export async function buildAgentRoomRunDetail(
  repositories: AgentRoomRepositories,
  agentRunId: string
): Promise<AgentRoomRunDetail | null> {
  const run = await repositories.agentRuns.getById(agentRunId);
  if (!run) return null;

  const [workflowRun, contextPack, artifacts, approvals, llmCalls, job] = await Promise.all([
    repositories.workflowRuns.getByAgentRunId(run.id),
    repositories.contextPacks.getById(run.contextPackId),
    repositories.artifacts.listByRunId(run.id),
    listApprovals(repositories, run.id),
    repositories.llmCallLogs.listByRunId(run.id),
    getJob(repositories, run.id)
  ]);

  const costSummary = summarizeCost(llmCalls);
  const allowedActions = deriveAllowedActions(run.status, job?.status);
  const durableJob = job ? toDurableJobView(job, await getReplayLineage(repositories, job)) : null;

  return {
    run: {
      ...toRunListItem(run, approvals, costSummary, allowedActions, job),
      contextPackId: run.contextPackId
    },
    workflowRun,
    graph: toGraph(workflowRun),
    contextPack: contextPack ? toContextPackView(contextPack) : null,
    artifacts: artifacts.map(toArtifactView),
    approvals,
    durableJob,
    costSummary
  };
}

export async function runAgentRoomAction(
  repositories: AgentRoomActionRepositories,
  agentRunId: string,
  action: AgentRoomAllowedAction
): Promise<AgentRoomActionResult> {
  const run = await repositories.agentRuns.getById(agentRunId);
  if (!run) throw new Error(`Agent run not found: ${agentRunId}`);

  const job = await repositories.durableJobs.getByAgentRunId(agentRunId);
  if (!job) throw new Error(`Durable job not found for agent run: ${agentRunId}`);

  if (!deriveAllowedActions(run.status, job.status).includes(action)) {
    throw new Error(`Action ${action} is not allowed for run ${agentRunId}`);
  }

  if (action === 'cancel') {
    return saveActionResult(repositories, action, run, { ...run, status: 'Cancelled' }, transitionJob(job, 'Cancelled'));
  }

  if (action === 'retry') {
    return saveActionResult(repositories, action, run, { ...run, status: 'Queued' }, transitionJob(job, 'Retrying'));
  }

  return saveActionResult(repositories, action, run, { ...run, status: 'Queued' }, replayJob(job));
}

async function buildRunListItem(
  repositories: AgentRoomRepositories,
  run: AgentRun
): Promise<AgentRoomRunListItem> {
  const [approvals, llmCalls, job] = await Promise.all([
    listApprovals(repositories, run.id),
    repositories.llmCallLogs.listByRunId(run.id),
    getJob(repositories, run.id)
  ]);

  return toRunListItem(run, approvals, summarizeCost(llmCalls), deriveAllowedActions(run.status, job?.status), job);
}

async function saveActionResult(
  repositories: AgentRoomActionRepositories,
  action: AgentRoomAllowedAction,
  originalRun: AgentRun,
  nextRun: AgentRun,
  nextJob: DurableJob
): Promise<AgentRoomActionResult> {
  await repositories.agentRuns.save(nextRun);
  await repositories.durableJobs.save(nextJob);

  return {
    action,
    runId: originalRun.id,
    runStatus: nextRun.status,
    jobId: nextJob.id,
    jobStatus: nextJob.status
  };
}

function toRunListItem(
  run: AgentRun,
  approvals: AgentRoomApproval[],
  costSummary: AgentRoomCostSummary,
  allowedActions: AgentRoomAllowedAction[],
  job: DurableJob | null
): AgentRoomRunListItem {
  return {
    id: run.id,
    agentName: run.agentName,
    taskType: run.taskType,
    workflowType: run.workflowType,
    promptVersionId: run.promptVersionId,
    status: run.status,
    jobStatus: job?.status,
    createdAt: run.createdAt,
    totalCostUsd: costSummary.totalCostUsd,
    pendingApprovalCount: approvals.filter((approval) => approval.status === 'Pending').length,
    allowedActions
  };
}

function toGraph(workflowRun: WorkflowRun | null): AgentRoomGraphStep[] {
  if (!workflowRun) return [];

  return workflowRun.steps.map((step) => ({
    id: `${workflowRun.id}:${step.order}`,
    order: step.order,
    name: step.name,
    status: step.status,
    artifactIds: step.artifactIds,
    retryAttempt: step.retryAttempt,
    error: step.error
  }));
}

function toContextPackView(contextPack: ContextPack): AgentRoomContextPackView {
  return {
    id: contextPack.id,
    artifactId: contextPack.artifactId,
    taskGoal: contextPack.taskGoal,
    agentRole: contextPack.agentRole,
    riskLevel: contextPack.riskLevel,
    sections: contextPack.sections,
    citations: contextPack.citations,
    exclusions: contextPack.exclusions,
    warnings: contextPack.warnings,
    retrievalTrace: contextPack.retrievalTrace,
    createdAt: contextPack.createdAt
  };
}

function toArtifactView(artifact: ArtifactRecord): AgentRoomArtifactView {
  return {
    id: artifact.id,
    type: artifact.type,
    source: artifact.source,
    version: artifact.version,
    hash: artifact.hash,
    uri: artifact.uri,
    relatedRunId: artifact.relatedRunId,
    createdAt: artifact.createdAt
  };
}

function summarizeCost(llmCalls: LlmCallRecord[]): AgentRoomCostSummary {
  const calls = llmCalls.map((call) => ({
    id: call.id,
    promptVersionId: call.promptVersionId,
    provider: call.provider,
    model: call.model,
    schemaName: call.schemaName,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
    durationMs: call.durationMs,
    estimatedCostUsd: call.estimatedCostUsd,
    retryCount: call.retryCount,
    status: call.status,
    error: call.error,
    createdAt: call.createdAt
  }));

  return {
    totalInputTokens: calls.reduce((total, call) => total + call.inputTokens, 0),
    totalOutputTokens: calls.reduce((total, call) => total + call.outputTokens, 0),
    totalCostUsd: roundCurrency(calls.reduce((total, call) => total + call.estimatedCostUsd, 0)),
    calls
  };
}

function toDurableJobView(job: DurableJob, lineage: string[]): AgentRoomDurableJobView {
  return {
    id: job.id,
    workflowType: job.workflowType,
    status: job.status,
    retryCount: job.retryCount,
    replayOfJobId: job.replayOfJobId,
    lineage
  };
}

function deriveAllowedActions(status: AgentRunStatus, jobStatus?: DurableJobStatus): AgentRoomAllowedAction[] {
  if (status === 'Running' || jobStatus === 'Running' || jobStatus === 'Queued' || jobStatus === 'Retrying') {
    return ['cancel'];
  }
  if (status === 'Failed' || jobStatus === 'Failed' || jobStatus === 'Cancelled') {
    return ['retry', 'replay'];
  }
  if (status === 'Succeeded') {
    return ['replay'];
  }
  return [];
}

async function listApprovals(repositories: AgentRoomRepositories, runId: string): Promise<AgentRoomApproval[]> {
  return repositories.approvals ? repositories.approvals.listByRunId(runId) : [];
}

async function getJob(repositories: AgentRoomRepositories, runId: string): Promise<DurableJob | null> {
  return repositories.durableJobs ? repositories.durableJobs.getByAgentRunId(runId) : null;
}

async function getReplayLineage(repositories: AgentRoomRepositories, job: DurableJob): Promise<string[]> {
  const lineage = await repositories.durableJobs?.findReplayLineage?.(job.id);
  return lineage && lineage.length > 0 ? lineage : [job.id];
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}
