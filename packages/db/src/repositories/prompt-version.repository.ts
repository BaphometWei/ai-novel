import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { promptVersions } from '../schema';

export type PromptVersionStatus = 'Active' | 'Deprecated' | 'Draft';

export interface PromptVersion {
  id: string;
  taskType: string;
  template: string;
  model: string;
  provider: string;
  version: number;
  status: PromptVersionStatus;
  createdAt: string;
}

export class PromptVersionRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(promptVersion: PromptVersion): Promise<void> {
    await this.db.insert(promptVersions).values({
      id: promptVersion.id,
      taskType: promptVersion.taskType,
      template: promptVersion.template,
      model: promptVersion.model,
      provider: promptVersion.provider,
      version: promptVersion.version,
      status: promptVersion.status,
      createdAt: promptVersion.createdAt
    });
  }

  async findById(id: string): Promise<PromptVersion | null> {
    const row = await this.db.select().from(promptVersions).where(eq(promptVersions.id, id)).get();
    if (!row) return null;

    return {
      id: row.id,
      taskType: row.taskType,
      template: row.template,
      model: row.model,
      provider: row.provider,
      version: row.version,
      status: row.status as PromptVersionStatus,
      createdAt: row.createdAt
    };
  }
}
