import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { observabilityMetricSnapshots } from '../schema';

export type ObservabilityCostSummary = {
  totalUsd: number;
  averageUsdPerRun: number;
};

export type ObservabilityLatencySummary = {
  averageDurationMs: number;
  p95DurationMs: number;
};

export type ObservabilityTokenSummary = {
  total: number;
  averagePerRun: number;
};

export type ObservabilityQualitySummary = {
  acceptedRate: number;
  openIssueCount: number;
  highSeverityOpenCount: number;
  outcomes: Record<string, number>;
};

export type ObservabilityAdoptionSummary = {
  adoptedRate: number;
  partialRate: number;
  rejectedRate: number;
  byFeature: Record<string, Record<string, number>>;
};

export type ObservabilityModelUsageSummary = {
  modelProvider: string;
  modelName: string;
  runCount: number;
  totalTokens: number;
  totalCostUsd: number;
};

export type ObservabilityRunErrorSummary = {
  code: string;
  count: number;
  retryableCount: number;
  maxSeverity: string;
};

export type ObservabilityWorkflowBottleneck = {
  workflowType: string;
  stepName: string;
  runCount: number;
  averageDurationMs: number;
  failureRate: number;
  retryPressure: number;
};

export type ObservabilityDataQualityIssue = {
  id: string;
  projectId: string;
  source: string;
  severity: string;
  status: string;
  message: string;
};

export type ObservabilityDataQualitySummary = {
  openIssueCount: number;
  highSeverityOpenCount: number;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  unresolved: ObservabilityDataQualityIssue[];
};

export interface ObservabilityMetricSnapshot {
  id: string;
  projectId: string;
  windowStartAt: string;
  windowEndAt: string;
  capturedAt: string;
  cost: ObservabilityCostSummary;
  latency: ObservabilityLatencySummary;
  tokens: ObservabilityTokenSummary;
  quality: ObservabilityQualitySummary;
  adoption: ObservabilityAdoptionSummary;
  modelUsage: ObservabilityModelUsageSummary[];
  runErrors: ObservabilityRunErrorSummary[];
  workflowBottlenecks: ObservabilityWorkflowBottleneck[];
  dataQuality: ObservabilityDataQualitySummary;
  sourceRunIds: string[];
}

export class ObservabilityRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsert(snapshot: ObservabilityMetricSnapshot): Promise<void> {
    const row = toRow(snapshot);
    await this.db
      .insert(observabilityMetricSnapshots)
      .values(row)
      .onConflictDoUpdate({
        target: observabilityMetricSnapshots.id,
        set: row
      });
  }

  async getLatestByProject(projectId: string): Promise<ObservabilityMetricSnapshot | null> {
    const row = await this.db
      .select()
      .from(observabilityMetricSnapshots)
      .where(eq(observabilityMetricSnapshots.projectId, projectId))
      .orderBy(desc(observabilityMetricSnapshots.capturedAt), sql`rowid DESC`)
      .get();

    return row ? toSnapshot(row) : null;
  }

  async listByProjectWindow(
    projectId: string,
    window: { windowStartAt: string; windowEndAt: string }
  ): Promise<ObservabilityMetricSnapshot[]> {
    const rows = await this.db
      .select()
      .from(observabilityMetricSnapshots)
      .where(
        and(
          eq(observabilityMetricSnapshots.projectId, projectId),
          gte(observabilityMetricSnapshots.windowStartAt, window.windowStartAt),
          lte(observabilityMetricSnapshots.windowEndAt, window.windowEndAt)
        )
      )
      .orderBy(asc(observabilityMetricSnapshots.windowStartAt), sql`rowid`)
      .all();

    return rows.map(toSnapshot);
  }
}

function toRow(
  snapshot: ObservabilityMetricSnapshot
): typeof observabilityMetricSnapshots.$inferInsert {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    windowStartAt: snapshot.windowStartAt,
    windowEndAt: snapshot.windowEndAt,
    capturedAt: snapshot.capturedAt,
    costJson: JSON.stringify(snapshot.cost),
    latencyJson: JSON.stringify(snapshot.latency),
    tokensJson: JSON.stringify(snapshot.tokens),
    qualityJson: JSON.stringify(snapshot.quality),
    adoptionJson: JSON.stringify(snapshot.adoption),
    modelUsageJson: JSON.stringify(snapshot.modelUsage),
    runErrorsJson: JSON.stringify(snapshot.runErrors),
    workflowBottlenecksJson: JSON.stringify(snapshot.workflowBottlenecks),
    dataQualityJson: JSON.stringify(snapshot.dataQuality),
    sourceRunIdsJson: JSON.stringify(snapshot.sourceRunIds)
  };
}

function toSnapshot(
  row: typeof observabilityMetricSnapshots.$inferSelect
): ObservabilityMetricSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    windowStartAt: row.windowStartAt,
    windowEndAt: row.windowEndAt,
    capturedAt: row.capturedAt,
    cost: JSON.parse(row.costJson) as ObservabilityCostSummary,
    latency: JSON.parse(row.latencyJson) as ObservabilityLatencySummary,
    tokens: JSON.parse(row.tokensJson) as ObservabilityTokenSummary,
    quality: JSON.parse(row.qualityJson) as ObservabilityQualitySummary,
    adoption: JSON.parse(row.adoptionJson) as ObservabilityAdoptionSummary,
    modelUsage: JSON.parse(row.modelUsageJson) as ObservabilityModelUsageSummary[],
    runErrors: JSON.parse(row.runErrorsJson) as ObservabilityRunErrorSummary[],
    workflowBottlenecks: JSON.parse(row.workflowBottlenecksJson) as ObservabilityWorkflowBottleneck[],
    dataQuality: JSON.parse(row.dataQualityJson) as ObservabilityDataQualitySummary,
    sourceRunIds: JSON.parse(row.sourceRunIdsJson) as string[]
  };
}
