import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('local production rehearsal', () => {
  it('runs a temp SQLite API flow with backup verify restore and local cleanup boundaries', async () => {
    const providedRoot = process.env.AI_NOVEL_REHEARSAL_ROOT;
    const root = providedRoot ?? (await mkdtemp(join(tmpdir(), 'ai-novel-local-production-')));
    const runtime = await createPersistentApiRuntime(join(root, 'workspace.sqlite'));

    try {
      const projectResponse = await runtime.app.inject({
        method: 'POST',
        url: '/projects',
        payload: {
          title: 'Local Production Rehearsal',
          language: 'en-US',
          targetAudience: 'serial fiction readers'
        }
      });
      expect(projectResponse.statusCode).toBe(201);
      const project = projectResponse.json();

      const chapterResponse = await runtime.app.inject({
        method: 'POST',
        url: `/projects/${project.id}/chapters`,
        payload: {
          title: 'Rehearsal Chapter',
          order: 1,
          body: 'The fake provider is not needed for backup and restore rehearsal.',
          status: 'Accepted'
        }
      });
      expect(chapterResponse.statusCode).toBe(201);

      const backupResponse = await runtime.app.inject({
        method: 'POST',
        url: `/projects/${project.id}/backups`,
        payload: { reason: 'local-production-rehearsal', requestedBy: 'script' }
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

      const restoreResponse = await runtime.app.inject({
        method: 'POST',
        url: '/backups/restore',
        payload: {
          path: backup.record.path,
          targetProjectId: 'project_local_rehearsal_restored',
          requestedBy: 'script'
        }
      });
      expect(restoreResponse.statusCode).toBe(200);
      expect(restoreResponse.json()).toMatchObject({
        status: { ok: true, stage: 'restored', hash: backup.record.hash },
        record: {
          targetProjectId: 'project_local_rehearsal_restored',
          rollbackActions: [{ type: 'delete_project', targetId: 'project_local_rehearsal_restored' }]
        }
      });

      const restoredChaptersResponse = await runtime.app.inject({
        method: 'GET',
        url: '/projects/project_local_rehearsal_restored/chapters'
      });
      expect(restoredChaptersResponse.statusCode).toBe(200);
      expect(restoredChaptersResponse.json()).toEqual([
        expect.objectContaining({
          title: 'Rehearsal Chapter'
        })
      ]);
    } finally {
      await runtime.database.client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
      await runtime.app.close();
      runtime.database.client.close();
      if (!providedRoot) {
        await cleanupBestEffort(root);
      }
    }
  }, 15_000);
});

async function cleanupBestEffort(root: string): Promise<void> {
  try {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // The standalone rehearsal script removes its temp workspace after the Vitest process exits.
  }
}
