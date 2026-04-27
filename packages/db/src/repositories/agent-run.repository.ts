import type { AgentRun } from '@ai-novel/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { agentRuns } from '../schema';

function toAgentRun(row: typeof agentRuns.$inferSelect): AgentRun {
  return {
    id: row.id as AgentRun['id'],
    agentName: row.agentName,
    taskType: row.taskType,
    workflowType: row.workflowType,
    promptVersionId: row.promptVersionId,
    contextPackId: row.contextPackId as AgentRun['contextPackId'],
    status: row.status as AgentRun['status'],
    createdAt: row.createdAt
  };
}

export class AgentRunRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(agentRun: AgentRun): Promise<void> {
    await this.db
      .insert(agentRuns)
      .values({
        id: agentRun.id,
        agentName: agentRun.agentName,
        taskType: agentRun.taskType,
        workflowType: agentRun.workflowType,
        promptVersionId: agentRun.promptVersionId,
        contextPackId: agentRun.contextPackId,
        status: agentRun.status,
        createdAt: agentRun.createdAt
      })
      .onConflictDoUpdate({
        target: agentRuns.id,
        set: {
          agentName: agentRun.agentName,
          taskType: agentRun.taskType,
          workflowType: agentRun.workflowType,
          promptVersionId: agentRun.promptVersionId,
          contextPackId: agentRun.contextPackId,
          status: agentRun.status,
          createdAt: agentRun.createdAt
        }
      });
  }

  async findById(id: string): Promise<AgentRun | null> {
    const row = await this.db.select().from(agentRuns).where(eq(agentRuns.id, id)).get();
    if (!row) return null;

    return toAgentRun(row);
  }

  async list(filters: {
    workflowType?: AgentRun['workflowType'];
    taskType?: AgentRun['taskType'];
    status?: AgentRun['status'];
    limit?: number;
  }): Promise<AgentRun[]> {
    const rows = await this.db
      .select()
      .from(agentRuns)
      .where(
        and(
          filters.workflowType ? eq(agentRuns.workflowType, filters.workflowType) : undefined,
          filters.taskType ? eq(agentRuns.taskType, filters.taskType) : undefined,
          filters.status ? eq(agentRuns.status, filters.status) : undefined
        )
      )
      .orderBy(asc(agentRuns.createdAt), sql`rowid`)
      .limit(filters.limit ?? -1);

    return rows.map(toAgentRun);
  }
}
