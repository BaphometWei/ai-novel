import Fastify from 'fastify';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registerBackupRoutes } from '../routes/backup.routes';
import { createPersistentApiRuntime } from '../runtime';
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

  it('uses persistent backup dependencies in the production runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    try {
      const projectResponse = await runtime.app.inject({
        method: 'POST',
        url: '/projects',
        payload: {
          title: 'Persistent Archive',
          language: 'en-US',
          targetAudience: 'serial fiction readers'
        }
      });
      const project = projectResponse.json();
      const chapterResponse = await runtime.app.inject({
        method: 'POST',
        url: `/projects/${project.id}/chapters`,
        payload: {
          title: 'Restorable Chapter',
          order: 1,
          body: 'The restored chapter keeps its body.',
          status: 'Accepted'
        }
      });
      expect(chapterResponse.statusCode).toBe(201);

      const backupResponse = await runtime.app.inject({
        method: 'POST',
        url: `/projects/${project.id}/backups`,
        payload: { reason: 'manual', requestedBy: 'operator' }
      });

      expect(backupResponse.statusCode).toBe(201);
      const backup = backupResponse.json();
      expect(backup.record.path).not.toMatch(/^memory:\/\//);
      expect(backup.record.manifest.sections).toEqual(
        expect.arrayContaining(['project', 'manuscripts', 'artifacts', 'canon', 'knowledge', 'runs', 'settings'])
      );

      const verifyResponse = await runtime.app.inject({
        method: 'POST',
        url: '/backups/verify',
        payload: { path: backup.record.path }
      });

      expect(verifyResponse.statusCode).toBe(200);
      expect(verifyResponse.json()).toMatchObject({
        record: { path: backup.record.path, projectId: project.id },
        status: { ok: true, stage: 'verified', hash: backup.record.hash }
      });

      const restoreResponse = await runtime.app.inject({
        method: 'POST',
        url: '/backups/restore',
        payload: { path: backup.record.path, targetProjectId: 'project_restored', requestedBy: 'operator' }
      });
      const restoredProjectResponse = await runtime.app.inject({ method: 'GET', url: '/projects/project_restored' });
      const restoredChaptersResponse = await runtime.app.inject({
        method: 'GET',
        url: '/projects/project_restored/chapters'
      });

      expect(restoreResponse.statusCode).toBe(200);
      expect(restoreResponse.json()).toMatchObject({
        record: { targetProjectId: 'project_restored', backupId: backup.record.id },
        status: { ok: true, stage: 'restored', hash: backup.record.hash }
      });
      expect(restoredProjectResponse.statusCode).toBe(200);
      expect(restoredProjectResponse.json()).toMatchObject({ id: 'project_restored', title: 'Persistent Archive' });
      expect(restoredChaptersResponse.statusCode).toBe(200);
      expect(restoredChaptersResponse.json()).toEqual([
        expect.objectContaining({
          title: 'Restorable Chapter',
          currentVersionId: expect.stringMatching(/^manuscript_version_/),
          versions: [
            expect.objectContaining({
              status: 'Accepted',
              bodyArtifactId: chapterResponse.json().version.bodyArtifactId
            })
          ]
        })
      ]);
    } finally {
      await runtime.app.close();
      runtime.database.client.close();
    }
  });

  it('rehearses temp SQLite backup verify restore rollback and cross-project isolation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-novel-recovery-'));
    const runtime = await createPersistentApiRuntime(join(root, 'recovery.sqlite'));

    try {
      const source = await createProject(runtime.app, 'Recovery Source');
      const untouched = await createProject(runtime.app, 'Recovery Untouched');
      const sourceChapter = await createChapter(runtime.app, source.id, {
        title: 'Recovery Source Chapter',
        body: 'Only the source chapter belongs in the backup envelope.'
      });
      const untouchedChapter = await createChapter(runtime.app, untouched.id, {
        title: 'Untouched Chapter',
        body: 'This unrelated project must stay out of the source backup.'
      });

      const backupResponse = await runtime.app.inject({
        method: 'POST',
        url: `/projects/${source.id}/backups`,
        payload: { reason: 'local-recovery-rehearsal', requestedBy: 'operator' }
      });
      expect(backupResponse.statusCode).toBe(201);
      const backup = backupResponse.json();

      const verifyResponse = await runtime.app.inject({
        method: 'POST',
        url: '/backups/verify',
        payload: { path: backup.record.path }
      });
      expect(verifyResponse.statusCode).toBe(200);
      expect(verifyResponse.json()).toMatchObject({
        status: { ok: true, stage: 'verified', hash: backup.record.hash }
      });

      const envelope = JSON.parse(
        await readFile(join(root, 'backups', backup.record.path), 'utf8')
      ) as {
        payload: {
          project: { id: string };
          manuscripts: Array<{ projectId: string; chapters: Array<{ title: string }> }>;
          artifacts: Array<{ id: string }>;
          runs: Array<{ id: string }>;
        };
      };
      const artifactIds = envelope.payload.artifacts.map((artifact) => artifact.id);

      expect(envelope.payload.project.id).toBe(source.id);
      expect(envelope.payload.manuscripts.map((manuscript) => manuscript.projectId)).toEqual([source.id]);
      expect(envelope.payload.manuscripts[0].chapters.map((chapter) => chapter.title)).toEqual([
        'Recovery Source Chapter'
      ]);
      expect(artifactIds).toContain(sourceChapter.version.bodyArtifactId);
      expect(artifactIds).not.toContain(untouchedChapter.version.bodyArtifactId);
      expect(envelope.payload.runs).toEqual([]);

      const restoredProjectId = 'project_recovery_restored';
      const restoreResponse = await runtime.app.inject({
        method: 'POST',
        url: '/backups/restore',
        payload: { path: backup.record.path, targetProjectId: restoredProjectId, requestedBy: 'operator' }
      });
      expect(restoreResponse.statusCode).toBe(200);
      const restore = restoreResponse.json();
      expect(restore).toMatchObject({
        record: {
          backupId: backup.record.id,
          sourceProjectId: source.id,
          targetProjectId: restoredProjectId,
          rollbackActions: [{ type: 'delete_project', targetId: restoredProjectId }]
        },
        status: { ok: true, stage: 'restored', hash: backup.record.hash }
      });

      await expect(runtime.stores.workflow.durableJobs.findById(restore.record.id)).resolves.toMatchObject({
        id: restore.record.id,
        workflowType: 'backup.restore',
        payload: {
          targetProjectId: restoredProjectId,
          rollbackActions: [{ type: 'delete_project', targetId: restoredProjectId }]
        }
      });

      const restoredChaptersResponse = await runtime.app.inject({
        method: 'GET',
        url: `/projects/${restoredProjectId}/chapters`
      });
      expect(restoredChaptersResponse.statusCode).toBe(200);
      const restoredChapters = restoredChaptersResponse.json();
      expect(restoredChapters).toEqual([
        expect.objectContaining({
          title: 'Recovery Source Chapter'
        })
      ]);

      const restoredBodyResponse = await runtime.app.inject({
        method: 'GET',
        url: `/chapters/${restoredChapters[0].id}/current-body`
      });
      expect(restoredBodyResponse.statusCode).toBe(200);
      expect(restoredBodyResponse.json()).toMatchObject({
        body: 'Only the source chapter belongs in the backup envelope.'
      });

      const untouchedChaptersResponse = await runtime.app.inject({
        method: 'GET',
        url: `/projects/${untouched.id}/chapters`
      });
      expect(untouchedChaptersResponse.statusCode).toBe(200);
      expect(untouchedChaptersResponse.json()).toEqual([
        expect.objectContaining({
          title: 'Untouched Chapter',
          versions: [
            expect.objectContaining({
              bodyArtifactId: untouchedChapter.version.bodyArtifactId
            })
          ]
        })
      ]);
    } finally {
      await runtime.database.client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
      await runtime.app.close();
      runtime.database.client.close();
      await removeTempRoot(root);
    }
  }, 15_000);
});

async function createBackupFixture(app: ReturnType<typeof Fastify>) {
  const response = await app.inject({ method: 'POST', url: '/projects/project_1/backups', payload: {} });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function removeTempRoot(root: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      return;
    } catch (error) {
      if (attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function createProject(app: ReturnType<typeof Fastify>, title: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/projects',
    payload: {
      title,
      language: 'en-US',
      targetAudience: 'serial fiction readers'
    }
  });
  expect(response.statusCode).toBe(201);
  return response.json() as { id: string; title: string };
}

async function createChapter(
  app: ReturnType<typeof Fastify>,
  projectId: string,
  input: { title: string; body: string }
) {
  const response = await app.inject({
    method: 'POST',
    url: `/projects/${projectId}/chapters`,
    payload: {
      title: input.title,
      order: 1,
      body: input.body,
      status: 'Accepted'
    }
  });
  expect(response.statusCode).toBe(201);
  return response.json() as { version: { bodyArtifactId: string } };
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
