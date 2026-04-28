import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';
import { createDatabase, DurableJobRepository, migrateDatabase, ProjectBundleRepository } from '@ai-novel/db';
import { createPersistentImportExportStore, type ImportExportRouteStore } from '../routes/import-export.routes';

describe('import/export API routes', () => {
  it('enqueues import jobs and export bundle jobs, then reads export bundles', async () => {
    const app = buildApp({ importExport: createImportExportStore() });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/imports/jobs',
      payload: { projectId: 'project_1', sourceUri: 'upload://draft.zip', mode: 'merge' }
    });
    const exportResponse = await app.inject({
      method: 'POST',
      url: '/exports/bundles',
      payload: { projectId: 'project_1', includeArtifacts: true }
    });
    const readResponse = await app.inject({ method: 'GET', url: '/exports/bundles/export_bundle_1' });
    const readImportJobResponse = await app.inject({ method: 'GET', url: '/imports/jobs/import_job_1' });
    const readExportJobResponse = await app.inject({ method: 'GET', url: '/exports/jobs/export_job_1' });

    expect(importResponse.statusCode).toBe(202);
    expect(importResponse.json()).toEqual({
      job: {
        id: 'import_job_1',
        type: 'import.project',
        status: 'Queued',
        projectId: 'project_1',
        payload: { sourceUri: 'upload://draft.zip', mode: 'merge' }
      }
    });
    expect(exportResponse.statusCode).toBe(202);
    expect(exportResponse.json()).toEqual({
      job: {
        id: 'export_job_1',
        type: 'export.bundle',
        status: 'Queued',
        projectId: 'project_1',
        payload: { includeArtifacts: true }
      },
      bundle: {
        id: 'export_bundle_1',
        projectId: 'project_1',
        status: 'Queued',
        uri: 'memory://export_bundle_1.zip'
      }
    });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toEqual({
      id: 'export_bundle_1',
      projectId: 'project_1',
      status: 'Queued',
      uri: 'memory://export_bundle_1.zip'
    });
    expect(readImportJobResponse.statusCode).toBe(200);
    expect(readImportJobResponse.json()).toEqual(importResponse.json().job);
    expect(readExportJobResponse.statusCode).toBe(200);
    expect(readExportJobResponse.json()).toEqual(exportResponse.json().job);
  });

  it('persists import jobs, export jobs, and export bundles through DB-backed store', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const jobs = new DurableJobRepository(database.db);
    const bundles = new ProjectBundleRepository(database.db);
    const app = buildApp({ importExport: createPersistentImportExportStore({ jobs, bundles }) });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/imports/jobs',
      payload: { projectId: 'project_2', sourceUri: 'upload://draft.zip', mode: 'merge' }
    });
    const exportResponse = await app.inject({
      method: 'POST',
      url: '/exports/bundles',
      payload: { projectId: 'project_2', includeArtifacts: true }
    });
    const exported = exportResponse.json();
    const readResponse = await app.inject({ method: 'GET', url: `/exports/bundles/${exported.bundle.id}` });
    const readImportJobResponse = await app.inject({ method: 'GET', url: `/imports/jobs/${importResponse.json().job.id}` });
    const readExportJobResponse = await app.inject({ method: 'GET', url: `/exports/jobs/${exported.job.id}` });

    expect(importResponse.statusCode).toBe(202);
    expect(exportResponse.statusCode).toBe(202);
    expect(readResponse.statusCode).toBe(200);
    expect(readImportJobResponse.statusCode).toBe(200);
    expect(readImportJobResponse.json()).toEqual(importResponse.json().job);
    expect(readExportJobResponse.statusCode).toBe(200);
    expect(readExportJobResponse.json()).toEqual(exported.job);
    await expect(jobs.findById(importResponse.json().job.id)).resolves.toMatchObject({ workflowType: 'import.project' });
    await expect(jobs.findById(exported.job.id)).resolves.toMatchObject({ workflowType: 'export.bundle' });
    await expect(bundles.findBackupByPath(exported.bundle.uri)).resolves.toMatchObject({ project: { id: 'project_2' } });
    expect(readResponse.json()).toEqual(exported.bundle);

    database.client.close();
  });

  it('wires import/export persistence in persistent runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const importResponse = await runtime.app.inject({
      method: 'POST',
      url: '/imports/jobs',
      payload: { projectId: 'project_runtime', sourceUri: 'upload://runtime.zip', mode: 'replace' }
    });
    const exportResponse = await runtime.app.inject({
      method: 'POST',
      url: '/exports/bundles',
      payload: { projectId: 'project_runtime', includeArtifacts: false }
    });
    const exported = exportResponse.json();
    const readResponse = await runtime.app.inject({ method: 'GET', url: `/exports/bundles/${exported.bundle.id}` });
    const readImportJobResponse = await runtime.app.inject({
      method: 'GET',
      url: `/imports/jobs/${importResponse.json().job.id}`
    });
    const readExportJobResponse = await runtime.app.inject({ method: 'GET', url: `/exports/jobs/${exported.job.id}` });

    expect(importResponse.statusCode).toBe(202);
    expect(exportResponse.statusCode).toBe(202);
    expect(readResponse.statusCode).toBe(200);
    expect(readImportJobResponse.statusCode).toBe(200);
    expect(readExportJobResponse.statusCode).toBe(200);
    expect(readImportJobResponse.json()).toEqual(importResponse.json().job);
    expect(readExportJobResponse.json()).toEqual(exported.job);
    expect(readResponse.json()).toEqual(exported.bundle);
    await expect(runtime.stores.importExport.bundles.findBackupByPath(exported.bundle.uri)).resolves.toMatchObject({
      project: { id: 'project_runtime' }
    });

    const importWorkerRun = await runtime.app.inject({ method: 'POST', url: '/workflow/worker/run-once' });
    const exportWorkerRun = await runtime.app.inject({ method: 'POST', url: '/workflow/worker/run-once' });
    const persistedImportJob = await runtime.app.inject({
      method: 'GET',
      url: `/workflow/jobs/${importResponse.json().job.id}`
    });
    const persistedExportJob = await runtime.app.inject({
      method: 'GET',
      url: `/workflow/jobs/${exported.job.id}`
    });

    expect(importWorkerRun.json()).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(exportWorkerRun.json()).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(persistedImportJob.json()).toMatchObject({
      status: 'Succeeded',
      payload: { output: { status: 'Imported', sourceUri: 'upload://runtime.zip' } }
    });
    expect(persistedExportJob.json()).toMatchObject({
      status: 'Succeeded',
      payload: { output: { status: 'Exported', bundleUri: exported.bundle.uri } }
    });

    await runtime.app.close();
    runtime.database.client.close();
  });
});

function createImportExportStore(): ImportExportRouteStore {
  const bundle = {
    id: 'export_bundle_1',
    projectId: 'project_1',
    status: 'Queued' as const,
    uri: 'memory://export_bundle_1.zip'
  };

  return {
    async enqueueImportJob(input) {
      return {
        id: 'import_job_1',
        type: 'import.project',
        status: 'Queued',
        projectId: input.projectId,
        payload: { sourceUri: input.sourceUri, mode: input.mode }
      };
    },
    async enqueueExportBundle(input) {
      return {
        job: {
          id: 'export_job_1',
          type: 'export.bundle',
          status: 'Queued',
          projectId: input.projectId,
          payload: { includeArtifacts: input.includeArtifacts }
        },
        bundle
      };
    },
    async getImportJob(id) {
      return id === 'import_job_1'
        ? {
            id: 'import_job_1',
            type: 'import.project',
            status: 'Queued',
            projectId: 'project_1',
            payload: { sourceUri: 'upload://draft.zip', mode: 'merge' }
          }
        : null;
    },
    async getExportJob(id) {
      return id === 'export_job_1'
        ? {
            id: 'export_job_1',
            type: 'export.bundle',
            status: 'Queued',
            projectId: 'project_1',
            payload: { includeArtifacts: true }
          }
        : null;
    },
    async getExportBundle(id) {
      return id === bundle.id ? bundle : null;
    }
  };
}
