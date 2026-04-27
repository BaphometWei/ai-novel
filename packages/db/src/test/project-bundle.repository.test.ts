import { createProjectBundle, hashProjectBundle } from '@ai-novel/domain';
import type { RestoreRecord } from '@ai-novel/workflow';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ProjectBundleRepository } from '../repositories/project-bundle.repository';

describe('ProjectBundleRepository', () => {
  it('round-trips a project bundle through a new SQLite database with matching hashes and restore records', async () => {
    const sourceDatabase = createDatabase(':memory:');
    const targetDatabase = createDatabase(':memory:');
    await migrateDatabase(sourceDatabase.client);
    await migrateDatabase(targetDatabase.client);
    const sourceRepository = new ProjectBundleRepository(sourceDatabase.db);
    const targetRepository = new ProjectBundleRepository(targetDatabase.db);
    const bundle = createProjectBundle({
      project: { id: 'project_1', title: 'Sky Archive' },
      chapters: [{ id: 'chapter_1', title: 'Opening', body: 'Start' }],
      artifacts: [{ id: 'artifact_1', kind: 'raw-import', hash: 'abc' }],
      canon: [{ id: 'canon_1', text: 'Magic has a cost' }],
      knowledgeItems: [{ id: 'knowledge_1', text: 'Technique note' }],
      sourcePolicies: [{ id: 'policy_1', sampleId: 'sample_1', usage: 'allowed' }],
      runLogs: [{ id: 'run_1', agent: 'writer', status: 'complete' }],
      settingsSnapshot: { provider: 'local' },
      createdAt: '2026-04-27T00:00:00.000Z'
    });
    const restoreRecord: RestoreRecord = {
      id: 'restore_project_restored',
      bundleHash: bundle.hash,
      sourceProjectId: 'project_1',
      targetProjectId: 'project_restored',
      restoredAt: '2026-04-27T01:00:00.000Z',
      migrationsApplied: [],
      rollbackActions: [{ type: 'delete_project', targetId: 'project_restored' }]
    };

    await sourceRepository.saveBackup({
      path: 'backups/project_1.bundle.json',
      bundle,
      createdAt: '2026-04-27T00:05:00.000Z'
    });
    const loaded = await sourceRepository.findBundleByHash(bundle.hash);
    const loadedByPath = await sourceRepository.findBackupByPath('backups/project_1.bundle.json');
    await targetRepository.restoreBundle({
      path: 'restores/project_restored.bundle.json',
      bundle: loaded ?? bundle,
      createdAt: '2026-04-27T01:00:00.000Z',
      restoreRecord
    });

    const roundTripped = await targetRepository.findBundleByHash(bundle.hash);
    const restoredRecord = await targetRepository.findRestoreRecord('restore_project_restored');
    const restoredItems = await targetRepository.listRestoredItems('restore_project_restored');

    expect(loaded?.hash).toBe(bundle.hash);
    expect(loadedByPath?.hash).toBe(bundle.hash);
    expect(roundTripped?.hash).toBe(bundle.hash);
    expect(roundTripped?.project).toEqual(bundle.project);
    expect(roundTripped?.chapters).toEqual(bundle.chapters);
    expect(roundTripped?.artifacts).toEqual(bundle.artifacts);
    expect(roundTripped?.canon).toEqual(bundle.canon);
    expect(roundTripped?.knowledgeItems).toEqual(bundle.knowledgeItems);
    expect(roundTripped?.sourcePolicies).toEqual(bundle.sourcePolicies);
    expect(roundTripped?.runLogs).toEqual(bundle.runLogs);
    expect(roundTripped?.settingsSnapshot).toEqual(bundle.settingsSnapshot);
    expect(hashProjectBundle(roundTripped ?? bundle)).toBe(bundle.hash);
    expect(restoredRecord).toEqual(restoreRecord);
    expect(restoredItems.map((item) => item.section)).toEqual([
      'project',
      'chapters',
      'artifacts',
      'canon',
      'knowledgeItems',
      'sourcePolicies',
      'runLogs',
      'settingsSnapshot'
    ]);
    expect(restoredItems.find((item) => item.section === 'project')?.payload).toEqual({
      id: 'project_restored',
      title: 'Sky Archive',
      restoredFromProjectId: 'project_1'
    });
    expect(restoredItems.find((item) => item.section === 'chapters')?.payload).toEqual(bundle.chapters);
    expect(restoredItems.find((item) => item.section === 'settingsSnapshot')?.payload).toEqual(bundle.settingsSnapshot);
    sourceDatabase.client.close();
    targetDatabase.client.close();
  });
});
