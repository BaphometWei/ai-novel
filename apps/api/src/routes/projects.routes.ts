import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProjectService, type ProjectServiceLike } from '../services/project.service';

const createProjectSchema = z.object({
  title: z.string().min(1),
  language: z.enum(['zh-CN', 'en-US']),
  targetAudience: z.string().min(1)
});

const projectParamsSchema = z.object({
  id: z.string().min(1)
});

const externalModelPolicySchema = z.object({
  externalModelPolicy: z.enum(['Allowed', 'Disabled'])
});

export function registerProjectRoutes(app: FastifyInstance, service: ProjectServiceLike = new ProjectService()) {
  app.get('/projects', async () => service.list());

  app.post('/projects', async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid project payload',
        issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      });
    }

    const project = await service.create(parsed.data);
    return reply.code(201).send(project);
  });

  app.get('/projects/:id', async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const project = await service.findById(params.id);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    return reply.send(project);
  });

  app.patch('/projects/:id/external-model-policy', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const parsed = externalModelPolicySchema.safeParse(request.body);
    if (!params.success || !parsed.success) {
      return reply.code(400).send({ error: 'Invalid project payload' });
    }

    const project = await service.updateExternalModelPolicy(params.data.id, parsed.data.externalModelPolicy);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return reply.send(project);
  });
}
