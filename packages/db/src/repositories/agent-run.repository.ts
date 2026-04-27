import type { AgentRun } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { agentRuns } from '../schema';

export class AgentRunRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(agentRun: AgentRun): Promise<void> {
    await this.db.insert(agentRuns).values({
      id: agentRun.id,
      agentName: agentRun.agentName,
      taskType: agentRun.taskType,
      workflowType: agentRun.workflowType,
      promptVersionId: agentRun.promptVersionId,
      contextPackId: agentRun.contextPackId,
      status: agentRun.status,
      createdAt: agentRun.createdAt
    });
  }

  async findById(id: string): Promise<AgentRun | null> {
    const row = await this.db.select().from(agentRuns).where(eq(agentRuns.id, id)).get();
    if (!row) return null;

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
}
