import { hashProjectBundle, type ProjectBundle } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import {
  exportProjectBundle,
  type BundleMigration,
  readProjectBundleBackup,
  restoreProjectBundle,
  restoreProjectBundleFromBackup,
  writeProjectBundleBackup,
  type BackupStorage
} from './export-workflow';
import { importIntoProject } from './import-workflow';
import {
  exportProjectBundle as exportProjectBundleFromIndex,
  importIntoProject as importIntoProjectFromIndex,
  createBackup as createBackupFromIndex,
  extractMemoryFromAcceptedText as extractMemoryFromAcceptedTextFromIndex,
  listAgentRoomRuns as listAgentRoomRunsFromIndex,
  readProjectBundleBackup as readProjectBundleBackupFromIndex,
  restoreProjectBundle as restoreProjectBundleFromIndex,
  restoreBackup as restoreBackupFromIndex,
  restoreProjectBundleFromBackup as restoreProjectBundleFromBackupFromIndex,
  runWritingWorkflow as runWritingWorkflowFromIndex,
  verifyBackup as verifyBackupFromIndex,
  writeProjectBundleBackup as writeProjectBundleBackupFromIndex
} from './index';

describe('import/export workflows', () => {
  function memoryBackupStorage(): BackupStorage & { writes: Map<string, string> } {
    const writes = new Map<string, string>();
    return {
      writes,
      async writeText(path, content) {
        writes.set(path, content);
      },
      async readText(path) {
        const content = writes.get(path);
        if (!content) {
          throw new Error(`Missing backup ${path}`);
        }
        return content;
      }
    };
  }

  it('imports source items into an in-memory project with raw artifacts', () => {
    const project = {
      project: { id: 'project_1', title: 'Sky Archive' },
      chapters: [],
      artifacts: [],
      canon: [],
      knowledgeItems: [],
      sourcePolicies: [],
      runLogs: [],
      settingsSnapshot: {}
    };

    const result = importIntoProject(project, {
      createdAt: '2026-04-27T00:00:00.000Z',
      items: [
        { sourceType: 'markdown', name: 'one.md', content: '# One\nScene text.' },
        { sourceType: 'user-note', name: 'note', content: 'Keep the tower secret.' }
      ]
    });

    expect(result.project.chapters).toEqual([expect.objectContaining({ title: 'One', body: 'Scene text.' })]);
    expect(result.project.artifacts).toHaveLength(2);
    expect(result.project.knowledgeItems).toEqual([
      expect.objectContaining({
        status: 'candidate',
        type: 'note',
        text: 'Keep the tower secret.'
      })
    ]);
    expect(result.batch.items.map((item) => item.rawArtifact.id)).toEqual(
      result.project.artifacts.map((artifact) => artifact.id)
    );
  });

  it('exports and restores a project bundle with matching hashes', () => {
    const original = {
      project: { id: 'project_1', title: 'Sky Archive' },
      chapters: [{ id: 'chapter_1', title: 'Opening', body: 'Start' }],
      artifacts: [{ id: 'artifact_1', kind: 'raw-import', hash: 'abc' }],
      canon: [{ id: 'canon_1', text: 'Magic has a cost' }],
      knowledgeItems: [{ id: 'knowledge_1', text: 'Technique note' }],
      sourcePolicies: [{ id: 'policy_1', sampleId: 'sample_1', usage: 'allowed' }],
      runLogs: [{ id: 'run_1', agent: 'writer', status: 'complete' }],
      settingsSnapshot: { provider: 'local' }
    };

    const bundle = exportProjectBundle(original, {
      createdAt: '2026-04-27T00:00:00.000Z'
    });
    const restored = restoreProjectBundle(bundle, { newProjectId: 'project_restored' });

    expect(restored.project.project).toEqual({
      id: 'project_restored',
      title: 'Sky Archive',
      restoredFromProjectId: 'project_1'
    });
    expect(restored.project.chapters).toEqual(original.chapters);
    expect(restored.project.artifacts).toEqual(original.artifacts);
    expect(restored.project.canon).toEqual(original.canon);
    expect(restored.project.knowledgeItems).toEqual(original.knowledgeItems);
    expect(restored.project.sourcePolicies).toEqual(original.sourcePolicies);
    expect(restored.project.runLogs).toEqual(original.runLogs);
    expect(restored.project.settingsSnapshot).toEqual(original.settingsSnapshot);
    expect(restored.sourceBundleHash).toBe(bundle.hash);
    expect(restored.restoredBundleHash).toBe(bundle.hash);
  });

  it('writes and restores project bundle backups with rollback and migration records', async () => {
    const storage = memoryBackupStorage();
    const original = {
      project: { id: 'project_1', title: 'Sky Archive' },
      chapters: [{ id: 'chapter_1', title: 'Opening', body: 'Start' }],
      artifacts: [{ id: 'artifact_1', kind: 'raw-import', hash: 'abc' }],
      canon: [{ id: 'canon_1', text: 'Magic has a cost' }],
      knowledgeItems: [{ id: 'knowledge_1', text: 'Technique note' }],
      sourcePolicies: [{ id: 'policy_1', sampleId: 'sample_1', usage: 'allowed' }],
      runLogs: [{ id: 'run_1', agent: 'writer', status: 'complete' }],
      settingsSnapshot: { provider: 'local' }
    };
    const bundle = exportProjectBundle(original, {
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    const backup = await writeProjectBundleBackup(storage, 'backups/project_1.bundle.json', bundle);
    const readBundle = await readProjectBundleBackup(storage, backup.path);
    const restored = await restoreProjectBundleFromBackup(storage, backup.path, {
      newProjectId: 'project_restored',
      restoredAt: '2026-04-27T01:00:00.000Z',
      targetSchemaVersion: 1
    });

    expect(backup).toMatchObject({
      path: 'backups/project_1.bundle.json',
      bundleHash: bundle.hash,
      format: 'ai-novel-project-bundle'
    });
    expect(readBundle.hash).toBe(bundle.hash);
    expect(restored.project.project).toEqual({
      id: 'project_restored',
      title: 'Sky Archive',
      restoredFromProjectId: 'project_1'
    });
    expect(restored.restoreRecord).toEqual({
      id: 'restore_project_restored',
      bundleHash: bundle.hash,
      sourceProjectId: 'project_1',
      targetProjectId: 'project_restored',
      restoredAt: '2026-04-27T01:00:00.000Z',
      migrationsApplied: [],
      rollbackActions: [{ type: 'delete_project', targetId: 'project_restored' }]
    });
  });

  it('rejects tampered backup bundles before restore', async () => {
    const storage = memoryBackupStorage();
    const bundle = exportProjectBundle(
      {
        project: { id: 'project_1', title: 'Sky Archive' },
        chapters: [],
        artifacts: [],
        canon: [],
        knowledgeItems: [],
        sourcePolicies: [],
        runLogs: [],
        settingsSnapshot: {}
      },
      { createdAt: '2026-04-27T00:00:00.000Z' }
    );
    await writeProjectBundleBackup(storage, 'backups/project_1.bundle.json', bundle);
    const tampered = storage.writes.get('backups/project_1.bundle.json')?.replace('Sky Archive', 'Wrong Archive');
    storage.writes.set('backups/project_1.bundle.json', tampered ?? '');

    await expect(readProjectBundleBackup(storage, 'backups/project_1.bundle.json')).rejects.toThrow(
      'Project bundle hash mismatch'
    );
  });

  it('records only migrations that were actually applied during restore', async () => {
    const storage = memoryBackupStorage();
    const bundle = exportProjectBundle(
      {
        project: { id: 'project_1', title: 'Sky Archive' },
        chapters: [],
        artifacts: [],
        canon: [],
        knowledgeItems: [],
        sourcePolicies: [],
        runLogs: [],
        settingsSnapshot: { provider: 'local' }
      },
      { createdAt: '2026-04-27T00:00:00.000Z' }
    );
    const versionTwoMigration: BundleMigration = {
      fromVersion: 1,
      toVersion: 2,
      description: 'v1 settings snapshot migration',
      migrate: (current) => {
        const migrated = {
          ...current,
          version: 2,
          settingsSnapshot: { ...current.settingsSnapshot, schemaVersion: 2 }
        };
        return { ...migrated, hash: hashForMigratedBundle(migrated) };
      }
    };
    const skippedMigration: BundleMigration = {
      fromVersion: 1,
      toVersion: 3,
      description: 'skipped direct v1 migration',
      migrate: (current) => {
        const migrated = {
          ...current,
          version: 3,
          settingsSnapshot: { ...current.settingsSnapshot, shouldNotAppear: true }
        };
        return { ...migrated, hash: hashForMigratedBundle(migrated) };
      }
    };

    await writeProjectBundleBackup(storage, 'backups/project_1.bundle.json', bundle);

    const restored = await restoreProjectBundleFromBackup(storage, 'backups/project_1.bundle.json', {
      newProjectId: 'project_restored',
      targetSchemaVersion: 3,
      migrations: [versionTwoMigration, skippedMigration]
    });

    expect(restored.project.settingsSnapshot).toEqual({ provider: 'local', schemaVersion: 2 });
    expect(restored.restoreRecord.migrationsApplied).toEqual(['v1 settings snapshot migration']);
  });

  it('exports import/export workflows from the workflow package index', () => {
    expect(importIntoProjectFromIndex).toBe(importIntoProject);
    expect(exportProjectBundleFromIndex).toBe(exportProjectBundle);
    expect(restoreProjectBundleFromIndex).toBe(restoreProjectBundle);
    expect(writeProjectBundleBackupFromIndex).toBe(writeProjectBundleBackup);
    expect(readProjectBundleBackupFromIndex).toBe(readProjectBundleBackup);
    expect(restoreProjectBundleFromBackupFromIndex).toBe(restoreProjectBundleFromBackup);
  });

  it('exports V2 workflow cores from the workflow package index', () => {
    expect(runWritingWorkflowFromIndex).toBeTypeOf('function');
    expect(extractMemoryFromAcceptedTextFromIndex).toBeTypeOf('function');
    expect(listAgentRoomRunsFromIndex).toBeTypeOf('function');
    expect(createBackupFromIndex).toBeTypeOf('function');
    expect(verifyBackupFromIndex).toBeTypeOf('function');
    expect(restoreBackupFromIndex).toBeTypeOf('function');
  });
});

function hashForMigratedBundle(bundle: Omit<ProjectBundle, 'hash'>): ProjectBundle['hash'] {
  return hashProjectBundle(bundle);
}
