export type AgentRunStatus = 'Succeeded' | 'Failed';
export type QualityOutcome = 'accepted' | 'needs_revision' | 'rejected';
export type UserAdoption = 'adopted' | 'partial' | 'rejected';

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
}

export interface ModelUsageSummary {
  modelProvider: string;
  modelName: string;
  runCount: number;
  totalTokens: number;
  totalCostUsd: number;
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
    userAdoption: countBy(runs.map((run) => run.userAdoption))
  };
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
