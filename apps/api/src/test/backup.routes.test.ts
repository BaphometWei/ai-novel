import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerBackupRoutes } from '../routes/backup.routes';
import type { BackupWorkflowDependencies } from '@ai-novel/workflow';

describe('backup API routes', () => {
  it('creates a project backup through injected workflow dependencies', async () => {
    const deps = createMemoryDependencies({
      now: '2026-04-27T10:00:00.000Z',
      ids: ['backup_job_1', 'backup_1']
    });
    const app = Fastify();
    registerBackupRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/projects/project_1/backups',
      payload: { reason: 'manual', requestedBy: 'operator' }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      job: { id: 'backup_job_1', type: 'backup.create', status: 'Succeeded', projectId: 'project_1' },
      record: {
        id: 'backup_1',
        projectId: 'project_1',
        path: 'memory://backup_1.json',
        manifest: { reason: 'manual', requestedBy: 'operator' }
      },
      status: { ok: true, stage: 'created' }
    });
    expect(deps.store.writes.has('memory://backup_1.json')).toBe(true);
  });

  it('verifies backups and reports failed status for tampered content', async () => {
    const deps = createMemoryDependencies({
      now: '2026-04-27T10:00:00.000Z',
      ids: ['backup_job_1', 'backup_1', 'verify_job_1']
    });
    const app = Fastify();
    registerBackupRoutes(app, deps);
    const created = await createBackupFixture(app);
    deps.store.writes.set(created.record.path, deps.store.writes.get(created.record.path)?.replace('Sky Archive', 'Wrong Archive') ?? '');

    const response = await app.inject({
      method: 'POST',
      url: '/backups/verify',
      payload: { path: created.record.path }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      job: { id: 'verify_job_1', type: 'backup.verify', status: 'Failed', error: 'Backup hash mismatch' },
      status: { ok: false, stage: 'verify-rejected', error: 'Backup hash mismatch' }
    });
  });

  it('reports failed restore status for tampered content without restoring payloads', async () => {
    const deps = createMemoryDependencies({
      now: '2026-04-27T10:00:00.000Z',
      ids: ['backup_job_1', 'backup_1', 'restore_job_1']
    });
    const app = Fastify();
    registerBackupRoutes(app, deps);
    const created = await createBackupFixture(app);
    deps.store.writes.set(created.record.path, deps.store.writes.get(created.record.path)?.replace('Sky Archive', 'Wrong Archive') ?? '');

    const response = await app.inject({
      method: 'POST',
      url: '/backups/restore',
      payload: { path: created.record.path, targetProjectId: 'project_restored', requestedBy: 'operator' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      job: { id: 'restore_job_1', type: 'backup.restore', status: 'Failed', error: 'Backup hash mismatch' },
      status: { ok: false, stage: 'restore-rejected', error: 'Backup hash mismatch' }
    });
    expect(deps.repository.restoredPayloads).toEqual([]);
    expect(deps.repository.restores).toEqual([]);
  });
});

async function createBackupFixture(app: ReturnType<typeof Fastify>) {
  const response = await app.inject({ method: 'POST', url: '/projects/project_1/backups', payload: {} });
  expect(response.statusCode).toBe(201);
  return response.json();
}

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
