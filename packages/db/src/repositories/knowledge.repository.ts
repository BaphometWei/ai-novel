import { buildGenerationSourceContext, type GenerationSourceContext, type KnowledgeItem } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { knowledgeItems } from '../schema';

export class KnowledgeRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveKnowledgeItem(projectId: string, item: KnowledgeItem): Promise<void> {
    await this.db.insert(knowledgeItems).values({
      id: item.id,
      projectId,
      title: item.title,
      kind: item.kind,
      lifecycleStatus: item.lifecycleStatus,
      materialJson: JSON.stringify(item.material),
      tagsJson: JSON.stringify(item.tags),
      embeddingsJson: JSON.stringify(item.embeddings)
    });
  }

  async listKnowledgeItems(projectId: string): Promise<KnowledgeItem[]> {
    const rows = await this.db.select().from(knowledgeItems).where(eq(knowledgeItems.projectId, projectId)).all();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind as KnowledgeItem['kind'],
      lifecycleStatus: row.lifecycleStatus as KnowledgeItem['lifecycleStatus'],
      material: JSON.parse(row.materialJson) as KnowledgeItem['material'],
      tags: JSON.parse(row.tagsJson) as string[],
      embeddings: JSON.parse(row.embeddingsJson) as KnowledgeItem['embeddings']
    }));
  }

  async buildGenerationSourceContext(projectId: string): Promise<GenerationSourceContext> {
    const items = await this.listKnowledgeItems(projectId);
    return buildGenerationSourceContext(items);
  }
}
