import { describe, expect, it } from 'vitest';
import {
  createBackup,
  restoreBackup,
  verifyBackup,
  type BackupWorkflowDependencies
} from './backup-workflow';

describe('backup workflow core', () => {
  it('creates a backup artifact, manifest, durable job shape, and repository record', async () => {
    const deps = createMemoryDependencies({
      now: '2026-04-27T10:00:00.000Z',
      ids: ['backup_job_1', 'backup_1']
    });

    const result = await createBackup(
      {
        projectId: 'project_1',
        reason: 'manual',
        requestedBy: 'operator'
      },
      deps
    );

    expect(result.job).toEqual({
      id: 'backup_job_1',
      type: 'backup.create',
      status: 'Succeeded',
      projectId: 'project_1',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
      output: { backupId: 'backup_1', hash: result.record.hash }
    });
    expect(result.record).toEqual({
      id: 'backup_1',
      projectId: 'project_1',
      path: 'memory://backup_1.json',
      hash: result.record.hash,
      manifest: {
        backupId: 'backup_1',
        projectId: 'project_1',
        schemaVersion: 1,
        createdAt: '2026-04-27T10:00:00.000Z',
        reason: 'manual',
        requestedBy: 'operator',
        sections: ['project'],
        contentHash: result.record.manifest.contentHash
      },
      createdAt: '2026-04-27T10:00:00.000Z',
      byteLength: expect.any(Number)
    });
    expect(result.status).toEqual({ ok: true, stage: 'created', hash: result.record.hash });
    expect(deps.repository.backups).toEqual([result.record]);
    expect(JSON.parse(deps.store.writes.get('memory://backup_1.json') ?? '{}')).toMatchObject({
      manifest: result.record.manifest,
      payload: { project: { id: 'project_1', title: 'Sky Archive' } },
      hash: result.record.hash
    });
  });

  it('verifies a backup manifest and hash before restore is attempted', async () => {
    const deps = createMemoryDependencies({
      now: '2026-04-27T10:00:00.000Z',
      ids: ['backup_job_1', 'backup_1']
    });
    const created = await createBackup({ projectId: 'project_1' }, deps);

    const result = await verifyBackup({ path: created.record.path }, deps);

    expect(result.job).toMatchObject({
      type: 'backup.verify',
      status: 'Succeeded',
      output: { backupId: 'backup_1', hash: created.record.hash }
    });
    expect(result.record).toEqual(created.record);
    expect(result.status).toEqual({ ok: true, stage: 'verified', hash: created.record.hash });
  });

  it('restores a verified backup and records rollback metadata for API wrappers', async () => {
    const deps = createMemoryDependencies({
      now: '2026-04-27T10:00:00.000Z',
      ids: ['backup_job_1', 'backup_1', 'restore_job_1', 'restore_1']
    });
    const created = await createBackup({ projectId: 'project_1' }, deps);

    const result = await restoreBackup(
      {
        path: created.record.path,
        targetProjectId: 'project_restored',
        requestedBy: 'operator'
      },
      deps
    );

    expect(result.job).toMatchObject({
      id: 'restore_job_1',
      type: 'backup.restore',
      status: 'Succeeded',
      projectId: 'project_restored',
      output: { restoreId: 'restore_1', sourceBackupId: 'backup_1', hash: created.record.hash }
    });
    expect(result.record).toEqual({
      id: 'restore_1',
      backupId: 'backup_1',
      sourceProjectId: 'project_1',
      targetProjectId: 'project_restored',
      hash: created.record.hash,
      requestedBy: 'operator',
      restoredAt: '2026-04-27T10:00:00.000Z',
      rollbackActions: [{ type: 'delete_project', targetId: 'project_restored' }]
    });
    expect(result.status).toEqual({ ok: true, stage: 'restored', hash: created.record.hash });
    expect(deps.repository.restoredPayloads).toEqual([
      { targetProjectId: 'project_restored', payload: { project: { id: 'project_1', title: 'Sky Archive' } } }
    ]);
    expect(deps.repository.restores).toEqual([result.record]);
  });

  it('rejects tampered backup content before calling restore dependencies', async () => {
    const deps = createMemoryDependencies({
      now: '2026-04-27T10:00:00.000Z',
      ids: ['backup_job_1', 'backup_1', 'restore_job_1']
    });
    const created = await createBackup({ projectId: 'project_1' }, deps);
    deps.store.writes.set(created.record.path, deps.store.writes.get(created.record.path)?.replace('Sky Archive', 'Wrong Archive') ?? '');

    const result = await restoreBackup({ path: created.record.path, targetProjectId: 'project_restored' }, deps);

    expect(result.job).toMatchObject({
      type: 'backup.restore',
      status: 'Failed',
      error: 'Backup hash mismatch'
    });
    expect(result.status).toEqual({ ok: false, stage: 'restore-rejected', error: 'Backup hash mismatch' });
    expect(deps.repository.restoredPayloads).toEqual([]);
    expect(deps.repository.restores).toEqual([]);
  });
});

function createMemoryDependencies(options: { now: string; ids: string[] }): BackupWorkflowDependencies & {
  store: { writes: Map<string, string> };
  repository: {
    backups: unknown[];
    restores: unknown[];
    restoredPayloads: Array<{ targetProjectId: string; payload: unknown }>;
  };
} {
  const writes = new Map<string, string>();
  const backups: unknown[] = [];
  const restores: unknown[] = [];
  const restoredPayloads: Array<{ targetProjectId: string; payload: unknown }> = [];
  const ids = [...options.ids];

  return {
    clock: { now: () => options.now },
    ids: {
      createJobId: () => ids.shift() ?? 'job_extra',
      createBackupId: () => ids.shift() ?? 'backup_extra',
      createRestoreId: () => ids.shift() ?? 'restore_extra'
    },
    hash: stableTestHash,
    store: {
      writes,
      async writeText(path, content) {
        writes.set(path, content);
      },
      async readText(path) {
        const content = writes.get(path);
        if (!content) throw new Error(`Missing backup at ${path}`);
        return content;
      }
    },
    repository: {
      backups,
      restores,
      restoredPayloads,
      async readProjectSnapshot(projectId) {
        return { project: { id: projectId, title: 'Sky Archive' } };
      },
      backupPathFor(backupId) {
        return `memory://${backupId}.json`;
      },
      async saveBackupRecord(record) {
        backups.push(record);
      },
      async findBackupByPath(path) {
        return backups.find((record) => (record as { path: string }).path === path) as never;
      },
      async restoreProject(targetProjectId, payload) {
        restoredPayloads.push({ targetProjectId, payload });
      },
      async saveRestoreRecord(record) {
        restores.push(record);
      }
    }
  };
}

function stableTestHash(value: unknown): string {
  return `hash_${JSON.stringify(value).length}`;
}
