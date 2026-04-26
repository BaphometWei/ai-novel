export type AgentRunStatus = 'Succeeded' | 'Failed';
export type QualityOutcome = 'accepted' | 'needs_revision' | 'rejected';
export type UserAdoption = 'adopted' | 'partial' | 'rejected';
export type RunErrorSeverity = 'Warning' | 'Error' | 'Critical';
export type WorkflowStepStatus = 'Succeeded' | 'Failed';
export type DataQualitySeverity = 'Low' | 'Medium' | 'High';
export type DataQualityStatus = 'Open' | 'Resolved';

export interface RunError {
  id: string;
  code: string;
  message: string;
  severity: RunErrorSeverity;
  retryable: boolean;
  occurredAt: string;
}

export interface ObservableAgentRun {
  id: string;
  modelProvider: string;
  modelName: string;
  costUsd: number;
  tokens: {
    input: number;
    output: number;
  };
  durationMs: number;
  retryCount: number;
  contextLength: number;
  status: AgentRunStatus;
  qualityOutcome: QualityOutcome;
  userAdoption: UserAdoption;
  errors?: RunError[];
}

export interface ModelUsageSummary {
  modelProvider: string;
  modelName: string;
  runCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface RunErrorSummary {
  code: string;
  count: number;
  retryableCount: number;
  maxSeverity: RunErrorSeverity;
}

export interface ObservabilitySummary {
  totalCostUsd: number;
  totalTokens: number;
  averageDurationMs: number;
  failureRate: number;
  totalRetryCount: number;
  averageContextLength: number;
  modelUsage: ModelUsageSummary[];
  qualityOutcomes: Record<string, number>;
  userAdoption: Record<string, number>;
  runErrors: RunErrorSummary[];
}

export interface WorkflowStepTelemetry {
  workflowType: string;
  stepName: string;
  durationMs: number;
  status: WorkflowStepStatus;
  retryCount: number;
}

export interface WorkflowBottleneckReport {
  workflowType: string;
  stepName: string;
  runCount: number;
  averageDurationMs: number;
  failureRate: number;
  retryPressure: number;
}

export interface DataQualityIssue {
  id: string;
  projectId: string;
  source: 'canon' | 'knowledge' | 'agent_run' | 'retrieval' | 'import';
  severity: DataQualitySeverity;
  status: DataQualityStatus;
  message: string;
}

export interface DataQualitySummary {
  openIssueCount: number;
  highSeverityOpenCount: number;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  unresolved: DataQualityIssue[];
}

export function summarizeObservability(runs: ObservableAgentRun[]): ObservabilitySummary {
  const totalCostUsd = sum(runs.map((run) => run.costUsd));
  const totalTokens = sum(runs.map((run) => tokenCount(run)));
  const modelUsageByKey = new Map<string, ModelUsageSummary>();

  for (const run of runs) {
    const key = `${run.modelProvider}:${run.modelName}`;
    const current = modelUsageByKey.get(key) ?? {
      modelProvider: run.modelProvider,
      modelName: run.modelName,
      runCount: 0,
      totalTokens: 0,
      totalCostUsd: 0
    };
    current.runCount += 1;
    current.totalTokens += tokenCount(run);
    current.totalCostUsd += run.costUsd;
    modelUsageByKey.set(key, current);
  }

  return {
    totalCostUsd,
    totalTokens,
    averageDurationMs: average(runs.map((run) => run.durationMs)),
    failureRate: runs.length === 0 ? 0 : runs.filter((run) => run.status === 'Failed').length / runs.length,
    totalRetryCount: sum(runs.map((run) => run.retryCount)),
    averageContextLength: average(runs.map((run) => run.contextLength)),
    modelUsage: [...modelUsageByKey.values()],
    qualityOutcomes: countBy(runs.map((run) => run.qualityOutcome)),
    userAdoption: countBy(runs.map((run) => run.userAdoption)),
    runErrors: summarizeRunErrors(runs.flatMap((run) => run.errors ?? []))
  };
}

export function summarizeWorkflowBottlenecks(steps: WorkflowStepTelemetry[]): WorkflowBottleneckReport[] {
  const groups = new Map<string, WorkflowStepTelemetry[]>();
  for (const step of steps) {
    const key = `${step.workflowType}:${step.stepName}`;
    groups.set(key, [...(groups.get(key) ?? []), step]);
  }

  return [...groups.values()]
    .map((group) => {
      const first = group[0];
      return {
        workflowType: first.workflowType,
        stepName: first.stepName,
        runCount: group.length,
        averageDurationMs: average(group.map((step) => step.durationMs)),
        failureRate: group.filter((step) => step.status === 'Failed').length / group.length,
        retryPressure: sum(group.map((step) => step.retryCount))
      };
    })
    .sort((left, right) => right.averageDurationMs - left.averageDurationMs || right.failureRate - left.failureRate);
}

export function summarizeDataQualityIssues(issues: DataQualityIssue[]): DataQualitySummary {
  const unresolved = issues.filter((issue) => issue.status === 'Open');

  return {
    openIssueCount: unresolved.length,
    highSeverityOpenCount: unresolved.filter((issue) => issue.severity === 'High').length,
    bySource: countBy(unresolved.map((issue) => issue.source)),
    bySeverity: countBy(unresolved.map((issue) => issue.severity)),
    unresolved
  };
}

function summarizeRunErrors(errors: RunError[]): RunErrorSummary[] {
  const groups = new Map<string, RunError[]>();
  for (const error of errors) {
    groups.set(error.code, [...(groups.get(error.code) ?? []), error]);
  }

  return [...groups.entries()]
    .map(([code, group]) => ({
      code,
      count: group.length,
      retryableCount: group.filter((error) => error.retryable).length,
      maxSeverity: maxRunErrorSeverity(group.map((error) => error.severity))
    }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
}

function maxRunErrorSeverity(severities: RunErrorSeverity[]): RunErrorSeverity {
  const order: Record<RunErrorSeverity, number> = { Warning: 1, Error: 2, Critical: 3 };
  return severities.reduce<RunErrorSeverity>(
    (max, severity) => (order[severity] > order[max] ? severity : max),
    'Warning'
  );
}

function tokenCount(run: ObservableAgentRun): number {
  return run.tokens.input + run.tokens.output;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
