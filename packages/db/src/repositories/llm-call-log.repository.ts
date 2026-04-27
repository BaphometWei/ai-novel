import type { EntityId, LlmCallRecord } from '@ai-novel/domain';
import { asc, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { llmCallLogs } from '../schema';

const COST_SCALE = 1_000_000_000;

export class LlmCallLogRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(record: LlmCallRecord): Promise<void> {
    await this.db.insert(llmCallLogs).values({
      id: record.id,
      agentRunId: record.agentRunId,
      promptVersionId: record.promptVersionId,
      provider: record.provider,
      model: record.model,
      schemaName: record.schemaName,
      inputTokens: record.usage.inputTokens,
      outputTokens: record.usage.outputTokens,
      durationMs: record.durationMs,
      estimatedCostUsd: Math.round(record.estimatedCostUsd * COST_SCALE),
      retryCount: record.retryCount,
      status: record.status,
      error: record.error,
      createdAt: record.createdAt
    });
  }

  async findByAgentRunId(agentRunId: EntityId<'agent_run'>): Promise<LlmCallRecord[]> {
    const rows = await this.db
      .select()
      .from(llmCallLogs)
      .where(eq(llmCallLogs.agentRunId, agentRunId))
      .orderBy(asc(llmCallLogs.createdAt), sql`rowid`);

    return rows.map((row) => ({
      id: row.id as LlmCallRecord['id'],
      agentRunId: row.agentRunId as LlmCallRecord['agentRunId'],
      promptVersionId: row.promptVersionId,
      provider: row.provider,
      model: row.model,
      schemaName: row.schemaName ?? undefined,
      usage: {
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens
      },
      durationMs: row.durationMs,
      estimatedCostUsd: row.estimatedCostUsd / COST_SCALE,
      retryCount: row.retryCount,
      status: row.status as LlmCallRecord['status'],
      error: row.error ?? undefined,
      createdAt: row.createdAt
    }));
  }
}
