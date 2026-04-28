import {
  createBackup,
  restoreBackup,
  verifyBackup,
  type BackupWorkflowDependencies
} from '@ai-novel/workflow';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

const projectParamsSchema = z.object({
  projectId: z.string().min(1)
});

const createBackupSchema = z.object({
  reason: z.string().min(1).optional(),
  requestedBy: z.string().min(1).optional()
});

const verifyBackupSchema = z.object({
  path: z.string().min(1)
});

const restoreBackupSchema = z.object({
  path: z.string().min(1),
  targetProjectId: z.string().min(1),
  requestedBy: z.string().min(1).optional()
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid backup payload' });
}

export function registerBackupRoutes(app: FastifyInstance, deps: BackupWorkflowDependencies) {
  app.post('/projects/:projectId/backups', async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const parsed = createBackupSchema.safeParse(request.body ?? {});
    if (!parsed.success) return invalidPayload(reply);

    try {
      const result = await createBackup({ projectId: params.projectId, ...parsed.data }, deps);
      return reply.code(201).send(result);
    } catch (error) {
      if (isDependencyNotConfigured(error)) return reply.code(503).send({ error: error.message });
      throw error;
    }
  });

  app.post('/backups/verify', async (request, reply) => {
    const parsed = verifyBackupSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    try {
      const result = await verifyBackup(parsed.data, deps);
      return reply.send(result);
    } catch (error) {
      if (isDependencyNotConfigured(error)) return reply.code(503).send({ error: error.message });
      throw error;
    }
  });

  app.post('/backups/restore', async (request, reply) => {
    const parsed = restoreBackupSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    try {
      const result = await restoreBackup(parsed.data, deps);
      return reply.send(result);
    } catch (error) {
      if (isDependencyNotConfigured(error)) return reply.code(503).send({ error: error.message });
      throw error;
    }
  });
}

function isDependencyNotConfigured(error: unknown): error is Error {
  return error instanceof Error && error.message === 'Backup dependencies are not configured';
}
