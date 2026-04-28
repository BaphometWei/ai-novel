import type { ExternalModelPolicy, Project } from '@ai-novel/domain';
import { asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { projects } from '../schema';

export class ProjectRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(project: Project): Promise<void> {
    await this.db.insert(projects).values({
      id: project.id,
      title: project.title,
      language: project.language,
      status: project.status,
      externalModelPolicy: project.externalModelPolicy,
      readerContractJson: JSON.stringify(project.readerContract),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    });
  }

  async list(): Promise<Project[]> {
    const rows = await this.db.select().from(projects).orderBy(asc(projects.createdAt)).all();
    return rows.map(projectFromRow);
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.db.select().from(projects).where(eq(projects.id, id)).get();
    if (!row) return null;

    return projectFromRow(row);
  }

  async updateExternalModelPolicy(id: string, policy: ExternalModelPolicy): Promise<Project | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: Project = {
      ...existing,
      externalModelPolicy: policy,
      updatedAt: new Date().toISOString()
    };
    await this.db
      .update(projects)
      .set({
        externalModelPolicy: updated.externalModelPolicy,
        updatedAt: updated.updatedAt
      })
      .where(eq(projects.id, id));
    return updated;
  }
}

function projectFromRow(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id as Project['id'],
    title: row.title,
    language: row.language as Project['language'],
    status: row.status as Project['status'],
    externalModelPolicy: (row.externalModelPolicy ?? 'Allowed') as Project['externalModelPolicy'],
    readerContract: JSON.parse(row.readerContractJson) as Project['readerContract'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
