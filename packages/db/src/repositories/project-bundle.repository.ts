import { hashProjectBundle, type ProjectBundle } from '@ai-novel/domain';
import type { RestoreRecord } from '@ai-novel/workflow';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { projectBundleBackups, projectBundleRestoreItems, projectBundleRestores } from '../schema';

export type RestoredBundleSection =
  | 'project'
  | 'chapters'
  | 'artifacts'
  | 'canon'
  | 'knowledgeItems'
  | 'sourcePolicies'
  | 'runLogs'
  | 'settingsSnapshot';

export interface RestoredBundleItem {
  id: string;
  restoreId: string;
  bundleHash: string;
  targetProjectId: string;
  section: RestoredBundleSection;
  payload: unknown;
}

export class ProjectBundleRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveBackup(input: { path: string; bundle: ProjectBundle; createdAt: string }): Promise<void> {
    await this.db.insert(projectBundleBackups).values({
      hash: input.bundle.hash,
      path: input.path,
      bundleJson: JSON.stringify(input.bundle),
      createdAt: input.createdAt
    });
  }

  async findBundleByHash(hash: string): Promise<ProjectBundle | null> {
    const row = await this.db.select().from(projectBundleBackups).where(eq(projectBundleBackups.hash, hash)).get();
    if (!row) return null;

    const bundle = JSON.parse(row.bundleJson) as ProjectBundle;
    if (hashProjectBundle(bundle) !== bundle.hash) {
      throw new Error('Project bundle hash mismatch');
    }

    return bundle;
  }

  async restoreBundle(input: {
    path: string;
    bundle: ProjectBundle;
    createdAt: string;
    restoreRecord: RestoreRecord;
  }): Promise<void> {
    await this.saveBackup({ path: input.path, bundle: input.bundle, createdAt: input.createdAt });
    await this.saveRestoreRecord(input.restoreRecord);
    await this.db.insert(projectBundleRestoreItems).values(toRestoreItems(input.bundle, input.restoreRecord));
  }

  async saveRestoreRecord(record: RestoreRecord): Promise<void> {
    await this.db.insert(projectBundleRestores).values({
      id: record.id,
      bundleHash: record.bundleHash,
      sourceProjectIdJson: JSON.stringify(record.sourceProjectId),
      targetProjectId: record.targetProjectId,
      restoredAt: record.restoredAt,
      migrationsAppliedJson: JSON.stringify(record.migrationsApplied),
      rollbackActionsJson: JSON.stringify(record.rollbackActions)
    });
  }

  async findRestoreRecord(id: string): Promise<RestoreRecord | null> {
    const row = await this.db.select().from(projectBundleRestores).where(eq(projectBundleRestores.id, id)).get();
    if (!row) return null;

    return {
      id: row.id,
      bundleHash: row.bundleHash,
      sourceProjectId: JSON.parse(row.sourceProjectIdJson) as RestoreRecord['sourceProjectId'],
      targetProjectId: row.targetProjectId,
      restoredAt: row.restoredAt,
      migrationsApplied: JSON.parse(row.migrationsAppliedJson) as RestoreRecord['migrationsApplied'],
      rollbackActions: JSON.parse(row.rollbackActionsJson) as RestoreRecord['rollbackActions']
    };
  }

  async listRestoredItems(restoreId: string): Promise<RestoredBundleItem[]> {
    const rows = await this.db
      .select()
      .from(projectBundleRestoreItems)
      .where(eq(projectBundleRestoreItems.restoreId, restoreId))
      .all();

    return rows.map((row) => ({
      id: row.id,
      restoreId: row.restoreId,
      bundleHash: row.bundleHash,
      targetProjectId: row.targetProjectId,
      section: row.section as RestoredBundleSection,
      payload: JSON.parse(row.payloadJson) as unknown
    }));
  }
}

function toRestoreItems(bundle: ProjectBundle, record: RestoreRecord): Array<typeof projectBundleRestoreItems.$inferInsert> {
  const restoredProject = {
    ...bundle.project,
    id: record.targetProjectId,
    restoredFromProjectId: bundle.project.id
  };
  const sections: Array<{ section: RestoredBundleSection; payload: unknown }> = [
    { section: 'project', payload: restoredProject },
    { section: 'chapters', payload: bundle.chapters },
    { section: 'artifacts', payload: bundle.artifacts },
    { section: 'canon', payload: bundle.canon },
    { section: 'knowledgeItems', payload: bundle.knowledgeItems },
    { section: 'sourcePolicies', payload: bundle.sourcePolicies },
    { section: 'runLogs', payload: bundle.runLogs },
    { section: 'settingsSnapshot', payload: bundle.settingsSnapshot }
  ];

  return sections.map((item, index) => ({
    id: `${record.id}_item_${index + 1}`,
    restoreId: record.id,
    bundleHash: bundle.hash,
    targetProjectId: record.targetProjectId,
    section: item.section,
    payloadJson: JSON.stringify(item.payload)
  }));
}
