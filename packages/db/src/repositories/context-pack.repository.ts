import type { ContextPack } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { contextPacks } from '../schema';

export class ContextPackRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(contextPack: ContextPack): Promise<void> {
    await this.db.insert(contextPacks).values({
      id: contextPack.id,
      taskGoal: contextPack.taskGoal,
      agentRole: contextPack.agentRole,
      riskLevel: contextPack.riskLevel,
      sectionsJson: JSON.stringify(contextPack.sections),
      citationsJson: JSON.stringify(contextPack.citations),
      exclusionsJson: JSON.stringify(contextPack.exclusions),
      warningsJson: JSON.stringify(contextPack.warnings),
      retrievalTraceJson: JSON.stringify(contextPack.retrievalTrace),
      createdAt: contextPack.createdAt
    });
  }

  async findById(id: string): Promise<ContextPack | null> {
    const row = await this.db.select().from(contextPacks).where(eq(contextPacks.id, id)).get();
    if (!row) return null;

    return {
      id: row.id as ContextPack['id'],
      taskGoal: row.taskGoal,
      agentRole: row.agentRole,
      riskLevel: row.riskLevel as ContextPack['riskLevel'],
      sections: JSON.parse(row.sectionsJson) as ContextPack['sections'],
      citations: JSON.parse(row.citationsJson) as ContextPack['citations'],
      exclusions: JSON.parse(row.exclusionsJson) as ContextPack['exclusions'],
      warnings: JSON.parse(row.warningsJson) as ContextPack['warnings'],
      retrievalTrace: JSON.parse(row.retrievalTraceJson) as ContextPack['retrievalTrace'],
      createdAt: row.createdAt
    };
  }
}
