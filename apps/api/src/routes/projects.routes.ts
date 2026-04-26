import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProjectService } from '../services/project.service';

const createProjectSchema = z.object({
  title: z.string().min(1),
  language: z.enum(['zh-CN', 'en-US']),
  targetAudience: z.string().min(1)
});

export function registerProjectRoutes(app: FastifyInstance, service = new ProjectService()) {
  app.post('/projects', async (request, reply) => {
    const input = createProjectSchema.parse(request.body);
    const project = service.create(input);
    return reply.code(201).send(project);
  });

  app.get('/projects/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const project = service.findById(params.id);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    return reply.send(project);
  });
}
