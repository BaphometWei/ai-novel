import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createProjectBundle } from '@ai-novel/domain';
import type { ProjectBundleRepository, DurableJobRepository } from '@ai-novel/db';

export interface ImportJob {
  id: string;
  type: 'import.project';
  status: 'Queued';
  projectId: string;
  payload: {
    sourceUri: string;
    mode: 'replace' | 'merge';
  };
}

export interface ExportJob {
  id: string;
  type: 'export.bundle';
  status: 'Queued';
  projectId: string;
  payload: {
    includeArtifacts: boolean;
  };
}

export interface ExportBundle {
  id: string;
  projectId: string;
  status: 'Queued' | 'Succeeded' | 'Failed';
  uri: string;
}

export interface ImportExportRouteStore {
  enqueueImportJob(input: { projectId: string; sourceUri: string; mode: 'replace' | 'merge' }): Promise<ImportJob> | ImportJob;
  enqueueExportBundle(input: {
    projectId: string;
    includeArtifacts: boolean;
  }): Promise<{ job: ExportJob; bundle: ExportBundle }> | { job: ExportJob; bundle: ExportBundle };
  getImportJob(id: string): Promise<ImportJob | null> | ImportJob | null;
  getExportJob(id: string): Promise<ExportJob | null> | ExportJob | null;
  getExportBundle(id: string): Promise<ExportBundle | null> | ExportBundle | null;
}

export interface PersistentImportExportStoreDependencies {
  jobs: DurableJobRepository;
  bundles: ProjectBundleRepository;
  clock?: () => string;
  createId?: (prefix: string) => string;
}

const importJobSchema = z.object({
  projectId: z.string().min(1),
  sourceUri: z.string().min(1),
  mode: z.enum(['replace', 'merge']).default('merge')
});

const exportBundleSchema = z.object({
  projectId: z.string().min(1),
  includeArtifacts: z.boolean().default(true)
});

const bundleParamsSchema = z.object({
  id: z.string().min(1)
});

const jobParamsSchema = z.object({
  id: z.string().min(1)
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid import/export payload' });
}

export function createInMemoryImportExportStore(): ImportExportRouteStore {
  const importJobs = new Map<string, ImportJob>();
  const exportJobs = new Map<string, ExportJob>();
  const bundles = new Map<string, ExportBundle>();

  return {
    async enqueueImportJob(input) {
      const job: ImportJob = {
        id: createLocalId('import_job'),
        type: 'import.project',
        status: 'Queued',
        projectId: input.projectId,
        payload: { sourceUri: input.sourceUri, mode: input.mode }
      };
      importJobs.set(job.id, job);
      return job;
    },
    async enqueueExportBundle(input) {
      const bundle: ExportBundle = {
        id: createLocalId('export_bundle'),
        projectId: input.projectId,
        status: 'Queued',
        uri: `memory://${input.projectId}/export.zip`
      };
      const job: ExportJob = {
        id: createLocalId('export_job'),
        type: 'export.bundle',
        status: 'Queued',
        projectId: input.projectId,
        payload: { includeArtifacts: input.includeArtifacts }
      };
      bundles.set(bundle.id, bundle);
      exportJobs.set(job.id, job);

      return {
        job,
        bundle
      };
    },
    async getImportJob(id) {
      return importJobs.get(id) ?? null;
    },
    async getExportJob(id) {
      return exportJobs.get(id) ?? null;
    },
    async getExportBundle(id) {
      return bundles.get(id) ?? null;
    }
  };
}

export function createPersistentImportExportStore(dependencies: PersistentImportExportStoreDependencies): ImportExportRouteStore {
  const clock = dependencies.clock ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createLocalId;

  return {
    async enqueueImportJob(input) {
      const job: ImportJob = {
        id: createId('import_job'),
        type: 'import.project',
        status: 'Queued',
        projectId: input.projectId,
        payload: { sourceUri: input.sourceUri, mode: input.mode }
      };
      await dependencies.jobs.save({
        id: job.id,
        workflowType: job.type,
        payload: { projectId: job.projectId, ...job.payload },
        status: job.status,
        retryCount: 0
      });
      return job;
    },
    async enqueueExportBundle(input) {
      const id = createId('export_bundle');
      const bundle: ExportBundle = {
        id,
        projectId: input.projectId,
        status: 'Queued',
        uri: `db://${id}.zip`
      };

      const createdAt = clock();
      await dependencies.bundles.saveBackup({
        path: bundle.uri,
        bundle: createProjectBundle({ project: { id: input.projectId }, createdAt }),
        createdAt
      });

      const job: ExportJob = {
        id: createId('export_job'),
        type: 'export.bundle',
        status: 'Queued',
        projectId: input.projectId,
        payload: { includeArtifacts: input.includeArtifacts }
      };

      await dependencies.jobs.save({
        id: job.id,
        workflowType: job.type,
        payload: { projectId: job.projectId, bundleId: bundle.id, bundleUri: bundle.uri, ...job.payload },
        status: job.status,
        retryCount: 0
      });

      return { job, bundle };
    },
    async getImportJob(id) {
      const job = await dependencies.jobs.findById(id);
      if (!job || job.workflowType !== 'import.project') return null;

      return {
        id: job.id,
        type: 'import.project',
        status: job.status as ImportJob['status'],
        projectId: String(job.payload.projectId ?? ''),
        payload: {
          sourceUri: String(job.payload.sourceUri ?? ''),
          mode: job.payload.mode === 'replace' ? 'replace' : 'merge'
        }
      };
    },
    async getExportJob(id) {
      const job = await dependencies.jobs.findById(id);
      if (!job || job.workflowType !== 'export.bundle') return null;

      return {
        id: job.id,
        type: 'export.bundle',
        status: job.status as ExportJob['status'],
        projectId: String(job.payload.projectId ?? ''),
        payload: { includeArtifacts: job.payload.includeArtifacts !== false }
      };
    },
    async getExportBundle(id) {
      const path = `db://${id}.zip`;
      const found = await dependencies.bundles.findBackupByPath(path);
      if (!found) return null;
      return {
        id,
        projectId: String(found.project.id ?? ''),
        status: 'Queued',
        uri: path
      };
    }
  };
}

export function registerImportExportRoutes(
  app: FastifyInstance,
  store: ImportExportRouteStore = createInMemoryImportExportStore()
) {
  app.post('/imports/jobs', async (request, reply) => {
    const parsed = importJobSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.code(202).send({ job: await store.enqueueImportJob(parsed.data) });
  });

  app.get('/imports/jobs/:id', async (request, reply) => {
    const params = jobParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const job = await store.getImportJob(params.data.id);
    if (!job) return reply.code(404).send({ error: 'Import job not found' });
    return reply.send(job);
  });

  app.post('/exports/bundles', async (request, reply) => {
    const parsed = exportBundleSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.code(202).send(await store.enqueueExportBundle(parsed.data));
  });

  app.get('/exports/jobs/:id', async (request, reply) => {
    const params = jobParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const job = await store.getExportJob(params.data.id);
    if (!job) return reply.code(404).send({ error: 'Export job not found' });
    return reply.send(job);
  });

  app.get('/exports/bundles/:id', async (request, reply) => {
    const params = bundleParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const bundle = await store.getExportBundle(params.data.id);
    if (!bundle) return reply.code(404).send({ error: 'Export bundle not found' });
    return reply.send(bundle);
  });
}

function createLocalId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
