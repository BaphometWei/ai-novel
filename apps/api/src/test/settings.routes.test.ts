import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerSettingsRoutes } from '../routes/settings.routes';
import { SettingsService } from '../services/settings.service';

describe('settings API routes', () => {
  it('returns safe provider, routing, budget, and source-policy defaults before settings are saved', async () => {
    const app = Fastify();
    registerSettingsRoutes(app, new SettingsService());

    const provider = await app.inject({ method: 'GET', url: '/settings/providers/openai' });
    const routing = await app.inject({ method: 'GET', url: '/settings/model-routing/defaults' });
    const budget = await app.inject({ method: 'GET', url: '/settings/budgets/defaults' });
    const sourcePolicy = await app.inject({ method: 'GET', url: '/settings/source-policy/defaults' });

    expect(provider.statusCode).toBe(200);
    expect(provider.json()).toMatchObject({
      provider: 'openai',
      defaultModel: 'gpt-4o-mini',
      secretRef: 'env:OPENAI_API_KEY'
    });
    expect(provider.json().apiKey).toBeUndefined();
    expect(routing.statusCode).toBe(200);
    expect(routing.json()).toMatchObject({
      provider: 'openai',
      draftingModel: 'gpt-4o-mini',
      reviewModel: 'gpt-4o-mini',
      embeddingModel: 'text-embedding-3-small'
    });
    expect(budget.statusCode).toBe(200);
    expect(budget.json()).toMatchObject({
      provider: 'openai',
      maxRunCostUsd: 0.25,
      maxDailyCostUsd: 5,
      maxContextTokens: 16000
    });
    expect(sourcePolicy.statusCode).toBe(200);
    expect(sourcePolicy.json()).toMatchObject({
      allowUserSamples: true,
      allowLicensedSamples: false,
      allowPublicDomain: true,
      restrictedSourceIds: []
    });

    await app.close();
  });

  it('stores provider defaults and budget policies without returning raw api keys', async () => {
    const app = Fastify();
    registerSettingsRoutes(app, new SettingsService());

    const save = await app.inject({
      method: 'PUT',
      url: '/settings/providers/openai',
      payload: { apiKey: 'sk-local-secret', model: 'gpt-test', maxRunCostUsd: 0.25 }
    });
    const read = await app.inject({ method: 'GET', url: '/settings/providers/openai' });

    expect(save.statusCode).toBe(200);
    expect(save.json()).toMatchObject({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      budget: { maxRunCostUsd: 0.25 }
    });
    expect(JSON.stringify(save.json())).not.toContain('sk-local-secret');
    expect(read.statusCode).toBe(200);
    expect(read.json().apiKey).toBeUndefined();
    expect(read.json().secretRef).toBe('env:OPENAI_API_KEY');
    expect(JSON.stringify(read.json())).not.toContain('sk-local-secret');

    await app.close();
  });

  it('reads and saves model routing, budget, and source-policy defaults with redacted responses', async () => {
    const app = Fastify();
    registerSettingsRoutes(app, new SettingsService());

    const routing = await app.inject({
      method: 'PUT',
      url: '/settings/model-routing/defaults',
      payload: {
        provider: 'openai',
        draftingModel: 'gpt-draft',
        reviewModel: 'gpt-review',
        embeddingModel: 'text-embedding-test'
      }
    });
    const budgets = await app.inject({
      method: 'PUT',
      url: '/settings/budgets/defaults',
      payload: {
        provider: 'openai',
        maxRunCostUsd: 0.5,
        maxDailyCostUsd: 5,
        maxContextTokens: 16000
      }
    });
    const sourcePolicy = await app.inject({
      method: 'PUT',
      url: '/settings/source-policy/defaults',
      payload: {
        allowUserSamples: true,
        allowLicensedSamples: false,
        allowPublicDomain: true,
        restrictedSourceIds: ['sample_private']
      }
    });

    expect(routing.statusCode).toBe(200);
    expect(budgets.statusCode).toBe(200);
    expect(sourcePolicy.statusCode).toBe(200);
    await expect(app.inject({ method: 'GET', url: '/settings/model-routing/defaults' })).resolves.toMatchObject({
      statusCode: 200
    });
    expect((await app.inject({ method: 'GET', url: '/settings/model-routing/defaults' })).json()).toMatchObject({
      draftingModel: 'gpt-draft',
      reviewModel: 'gpt-review',
      embeddingModel: 'text-embedding-test'
    });
    expect((await app.inject({ method: 'GET', url: '/settings/budgets/defaults' })).json()).toMatchObject({
      provider: 'openai',
      maxRunCostUsd: 0.5,
      maxDailyCostUsd: 5,
      maxContextTokens: 16000
    });
    expect((await app.inject({ method: 'GET', url: '/settings/source-policy/defaults' })).json()).toMatchObject({
      allowUserSamples: true,
      allowLicensedSamples: false,
      allowPublicDomain: true,
      restrictedSourceIds: ['sample_private']
    });

    await app.close();
  });
});
