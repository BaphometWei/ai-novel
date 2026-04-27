import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SettingsService } from '../services/settings.service';

const providerParamsSchema = z.object({
  provider: z.string().min(1)
});

const providerDefaultsSchema = z.object({
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  secretRef: z.string().min(1).optional(),
  maxRunCostUsd: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional()
});

const modelRoutingDefaultsSchema = z.object({
  provider: z.string().min(1).default('openai'),
  draftingModel: z.string().min(1),
  reviewModel: z.string().min(1),
  embeddingModel: z.string().min(1).optional()
});

const budgetDefaultsSchema = z.object({
  provider: z.string().min(1).default('openai'),
  maxRunCostUsd: z.number().positive(),
  maxDailyCostUsd: z.number().positive().optional(),
  maxContextTokens: z.number().int().positive().optional()
});

const sourcePolicyDefaultsSchema = z.object({
  allowUserSamples: z.boolean().optional(),
  allowLicensedSamples: z.boolean().optional(),
  allowPublicDomain: z.boolean().optional(),
  restrictedSourceIds: z.array(z.string().min(1)).optional()
});

export function registerSettingsRoutes(app: FastifyInstance, service: SettingsService = new SettingsService()) {
  app.put('/settings/providers/:provider', async (request, reply) => {
    const params = providerParamsSchema.safeParse(request.params);
    const parsed = providerDefaultsSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    return service.saveProviderDefaults({ provider: params.data.provider, ...parsed.data });
  });

  app.get('/settings/providers/:provider', async (request, reply) => {
    const params = providerParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const settings = await service.findProviderDefaults(params.data.provider);
    if (!settings) return reply.code(404).send({ error: 'Settings not found' });
    return settings;
  });

  app.put('/settings/model-routing/defaults', async (request, reply) => {
    const parsed = modelRoutingDefaultsSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);
    return service.saveModelRoutingDefaults(parsed.data);
  });

  app.get('/settings/model-routing/defaults', async (_request, reply) => {
    const settings = await service.findModelRoutingDefaults();
    if (!settings) return reply.code(404).send({ error: 'Settings not found' });
    return settings;
  });

  app.put('/settings/budgets/defaults', async (request, reply) => {
    const parsed = budgetDefaultsSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);
    return service.saveBudgetDefaults(parsed.data);
  });

  app.get('/settings/budgets/defaults', async (_request, reply) => {
    const settings = await service.findBudgetDefaults();
    if (!settings) return reply.code(404).send({ error: 'Settings not found' });
    return settings;
  });

  app.put('/settings/source-policy/defaults', async (request, reply) => {
    const parsed = sourcePolicyDefaultsSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);
    return service.saveSourcePolicyDefaults(parsed.data);
  });

  app.get('/settings/source-policy/defaults', async (_request, reply) => {
    const settings = await service.findSourcePolicyDefaults();
    if (!settings) return reply.code(404).send({ error: 'Settings not found' });
    return settings;
  });
}

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid settings payload' });
}
