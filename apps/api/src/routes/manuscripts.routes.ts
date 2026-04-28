import type { EntityId } from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AcceptanceWorkflowService } from '../services/acceptance-workflow.service';
import type { ManuscriptService } from '../services/manuscript.service';

const projectParamsSchema = z.object({
  projectId: z.custom<EntityId<'project'>>(
    (value) => typeof value === 'string' && value.startsWith('project_'),
    'projectId must start with project_'
  )
});

const chapterParamsSchema = z.object({
  chapterId: z.custom<EntityId<'chapter'>>(
    (value) => typeof value === 'string' && value.startsWith('chapter_'),
    'chapterId must start with chapter_'
  )
});

const versionStatusSchema = z.enum(['Draft', 'Accepted', 'Rejected', 'Superseded']);
const createChapterVersionStatusSchema = z.enum(['Draft', 'Accepted']);

const createChapterSchema = z
  .object({
    title: z.string().min(1),
    order: z.number().int().positive().default(1),
    bodyArtifactId: z
      .custom<EntityId<'artifact'>>(
        (value) => typeof value === 'string' && value.startsWith('artifact_'),
        'bodyArtifactId must start with artifact_'
      )
      .optional(),
    body: z.string().min(1).optional(),
    status: createChapterVersionStatusSchema.optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .superRefine(validateBodyInput);

const createVersionSchema = z
  .object({
    bodyArtifactId: z
      .custom<EntityId<'artifact'>>(
        (value) => typeof value === 'string' && value.startsWith('artifact_'),
        'bodyArtifactId must start with artifact_'
      )
      .optional(),
    body: z.string().min(1).optional(),
    status: versionStatusSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
    makeCurrent: z.boolean().optional()
  })
  .superRefine((input, context) => {
    validateBodyInput(input, context);
    if ((input.status === 'Rejected' || input.status === 'Superseded') && input.makeCurrent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['makeCurrent'],
        message: `${input.status} versions cannot become current`
      });
    }
    if (input.status === 'Accepted' && input.makeCurrent === false) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['makeCurrent'],
        message: 'Accepted versions must become current'
      });
    }
  });

const acceptDraftSchema = z.object({
  runId: z.custom<EntityId<'agent_run'>>(
    (value) => typeof value === 'string' && value.startsWith('agent_run_'),
    'runId must start with agent_run_'
  ),
  draftArtifactId: z.custom<EntityId<'artifact'>>(
    (value) => typeof value === 'string' && value.startsWith('artifact_'),
    'draftArtifactId must start with artifact_'
  ),
  body: z.string().min(1),
  acceptedBy: z.string().min(1)
});

function validateBodyInput(
  input: { bodyArtifactId?: EntityId<'artifact'>; body?: string },
  context: z.RefinementCtx
) {
  if (!input.bodyArtifactId && !input.body) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bodyArtifactId'],
      message: 'bodyArtifactId or body is required'
    });
  }
  if (input.bodyArtifactId && input.body) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body'],
      message: 'Provide bodyArtifactId or body, not both'
    });
  }
}

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid manuscript payload' });
}

export function registerManuscriptRoutes(
  app: FastifyInstance,
  service: ManuscriptService,
  acceptanceWorkflow?: AcceptanceWorkflowService
) {
  app.get('/projects/:projectId/chapters', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const chapters = await service.listProjectChapters(params.data.projectId);
    if (!chapters) return reply.code(404).send({ error: 'Project not found' });
    return reply.send(chapters);
  });

  app.get('/chapters/:chapterId/current-body', async (request, reply) => {
    const params = chapterParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const currentBody = await service.getCurrentChapterBody(params.data.chapterId);
    if (!currentBody) return reply.code(404).send({ error: 'Current chapter body not found' });
    return reply.send(currentBody);
  });

  app.post('/projects/:projectId/chapters', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const parsed = createChapterSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    try {
      const result = await service.createProjectChapter(params.data.projectId, parsed.data);
      if (!result) return reply.code(404).send({ error: 'Project not found' });
      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof Error && /artifact/i.test(error.message)) {
        return reply.code(404).send({ error: 'Artifact not found' });
      }
      throw error;
    }
  });

  app.post('/chapters/:chapterId/versions', async (request, reply) => {
    const params = chapterParamsSchema.safeParse(request.params);
    const parsed = createVersionSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    try {
      const version = await service.addChapterVersion(params.data.chapterId, parsed.data);
      return reply.code(201).send(version);
    } catch (error) {
      if (error instanceof Error && /chapter/i.test(error.message)) {
        return reply.code(404).send({ error: 'Chapter not found' });
      }
      if (error instanceof Error && /artifact/i.test(error.message)) {
        return reply.code(404).send({ error: 'Artifact not found' });
      }
      throw error;
    }
  });

  if (acceptanceWorkflow) {
    app.post('/chapters/:chapterId/accept-draft', async (request, reply) => {
      const params = chapterParamsSchema.safeParse(request.params);
      const parsed = acceptDraftSchema.safeParse(request.body);
      if (!params.success || !parsed.success) return invalidPayload(reply);

      try {
        const result = await acceptanceWorkflow.acceptDraft({
          chapterId: params.data.chapterId,
          runId: parsed.data.runId,
          draftArtifactId: parsed.data.draftArtifactId,
          body: parsed.data.body,
          acceptedBy: parsed.data.acceptedBy
        });
        return reply.code(result.status === 'PendingApproval' ? 202 : 201).send(result);
      } catch (error) {
        if (error instanceof Error && /chapter/i.test(error.message)) {
          return reply.code(404).send({ error: 'Chapter not found' });
        }
        if (error instanceof Error && /provenance/i.test(error.message)) {
          return reply.code(409).send({ error: 'Draft provenance mismatch' });
        }
        throw error;
      }
    });
  }
}
