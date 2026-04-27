import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type SettingsApiClient } from '../api/client';
import { SettingsPanel } from '../components/SettingsPanel';

describe('SettingsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows loading before rendering provider, model, budget, and source policy settings', async () => {
    render(<SettingsPanel client={mockSettingsClient()} />);

    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('openai')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-draft')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
    expect(screen.getByLabelText('Allow user samples')).toBeChecked();
  });

  it('shows an error state when settings cannot be loaded', async () => {
    render(<SettingsPanel client={mockSettingsClient({ rejectLoad: true })} />);

    expect(await screen.findByText('Unable to load settings.')).toBeInTheDocument();
    expect(screen.getByText('Settings unavailable')).toBeInTheDocument();
  });

  it('saves provider defaults without rendering the raw API key', async () => {
    const client = mockSettingsClient();

    render(<SettingsPanel client={client} />);

    await screen.findByDisplayValue('gpt-default');
    fireEvent.change(screen.getByLabelText('Provider API key'), { target: { value: 'sk-local-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save provider defaults' }));

    expect(await screen.findByText('Provider defaults saved.')).toBeInTheDocument();
    expect(screen.queryByText('sk-local-secret')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('sk-local-secret')).not.toBeInTheDocument();
    expect(screen.getByText('env:OPENAI_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('[redacted]')).toBeInTheDocument();
  });

  it('edits and saves model routing, budget, and source policy defaults', async () => {
    const client = mockSettingsClient();
    const saveModelRouting = vi.spyOn(client, 'saveModelRoutingDefaults');
    const saveBudget = vi.spyOn(client, 'saveBudgetDefaults');
    const saveSourcePolicy = vi.spyOn(client, 'saveSourcePolicyDefaults');

    render(<SettingsPanel client={client} />);

    const modelRouting = await screen.findByLabelText('Model routing defaults');
    fireEvent.change(within(modelRouting).getByLabelText('Drafting model'), { target: { value: 'gpt-draft-next' } });
    fireEvent.change(within(modelRouting).getByLabelText('Review model'), { target: { value: 'gpt-review-next' } });
    fireEvent.change(within(modelRouting).getByLabelText('Embedding model'), {
      target: { value: 'text-embedding-3-large' }
    });
    fireEvent.click(within(modelRouting).getByRole('button', { name: 'Save model routing defaults' }));

    expect(await within(modelRouting).findByText('Model routing defaults saved.')).toBeInTheDocument();
    expect(saveModelRouting).toHaveBeenCalledWith({
      provider: 'openai',
      draftingModel: 'gpt-draft-next',
      reviewModel: 'gpt-review-next',
      embeddingModel: 'text-embedding-3-large'
    });

    const budget = screen.getByLabelText('Budget defaults');
    fireEvent.change(within(budget).getByLabelText('Max run cost'), { target: { value: '1.25' } });
    fireEvent.change(within(budget).getByLabelText('Max daily cost'), { target: { value: '8.5' } });
    fireEvent.change(within(budget).getByLabelText('Max context tokens'), { target: { value: '24000' } });
    fireEvent.click(within(budget).getByRole('button', { name: 'Save budget defaults' }));

    expect(await within(budget).findByText('Budget defaults saved.')).toBeInTheDocument();
    expect(saveBudget).toHaveBeenCalledWith({
      provider: 'openai',
      maxRunCostUsd: 1.25,
      maxDailyCostUsd: 8.5,
      maxContextTokens: 24000
    });

    const sourcePolicy = screen.getByLabelText('Source policy defaults');
    fireEvent.click(within(sourcePolicy).getByLabelText('Allow licensed samples'));
    fireEvent.click(within(sourcePolicy).getByLabelText('Allow public domain'));
    fireEvent.change(within(sourcePolicy).getByLabelText('Restricted source ids'), {
      target: { value: 'private_archive, embargoed_notes' }
    });
    fireEvent.click(within(sourcePolicy).getByRole('button', { name: 'Save source policy defaults' }));

    expect(await within(sourcePolicy).findByText('Source policy defaults saved.')).toBeInTheDocument();
    expect(saveSourcePolicy).toHaveBeenCalledWith({
      allowUserSamples: true,
      allowLicensedSamples: true,
      allowPublicDomain: false,
      restrictedSourceIds: ['private_archive', 'embargoed_notes']
    });
  });
});

describe('settings API client helpers', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads and saves settings through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/settings/providers/openai' && init?.method === 'PUT') {
        expect(JSON.parse(String(init.body))).toEqual({
          model: 'gpt-next',
          apiKey: 'sk-local-secret'
        });
        return jsonResponse({
          provider: 'openai',
          defaultModel: 'gpt-next',
          secretRef: 'env:OPENAI_API_KEY',
          redactedMetadata: { apiKey: '[redacted]' },
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      if (path === '/api/settings/providers/openai') {
        return jsonResponse({
          provider: 'openai',
          defaultModel: 'gpt-default',
          secretRef: 'env:OPENAI_API_KEY',
          redactedMetadata: {},
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      if (path === '/api/settings/model-routing/defaults') {
        if (init?.method === 'PUT') {
          return jsonResponse({
            ...JSON.parse(String(init.body)),
            updatedAt: '2026-04-27T00:00:00.000Z'
          });
        }
        return jsonResponse({
          provider: 'openai',
          draftingModel: 'gpt-draft',
          reviewModel: 'gpt-review',
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      if (path === '/api/settings/budgets/defaults') {
        if (init?.method === 'PUT') {
          return jsonResponse({
            ...JSON.parse(String(init.body)),
            updatedAt: '2026-04-27T00:00:00.000Z'
          });
        }
        return jsonResponse({
          provider: 'openai',
          maxRunCostUsd: 0.5,
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      if (path === '/api/settings/source-policy/defaults') {
        if (init?.method === 'PUT') {
          return jsonResponse({
            ...JSON.parse(String(init.body)),
            updatedAt: '2026-04-27T00:00:00.000Z'
          });
        }
        return jsonResponse({
          allowUserSamples: true,
          allowLicensedSamples: false,
          allowPublicDomain: true,
          restrictedSourceIds: [],
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });

    const client = createApiClient({ baseUrl: '/api', fetchImpl });
    const loaded = await client.loadSettingsDefaults('openai');
    const saved = await client.saveProviderDefaults('openai', {
      model: 'gpt-next',
      apiKey: 'sk-local-secret'
    });
    await client.saveModelRoutingDefaults({
      provider: 'openai',
      draftingModel: 'gpt-draft-next',
      reviewModel: 'gpt-review-next',
      embeddingModel: 'text-embedding-3-large'
    });
    await client.saveBudgetDefaults({
      provider: 'openai',
      maxRunCostUsd: 1.25,
      maxDailyCostUsd: 8.5,
      maxContextTokens: 24000
    });
    await client.saveSourcePolicyDefaults({
      allowUserSamples: true,
      allowLicensedSamples: true,
      allowPublicDomain: false,
      restrictedSourceIds: ['private_archive']
    });

    expect(loaded.provider.defaultModel).toBe('gpt-default');
    expect(loaded.modelRouting.reviewModel).toBe('gpt-review');
    expect(saved).toMatchObject({
      provider: 'openai',
      defaultModel: 'gpt-next',
      secretRef: 'env:OPENAI_API_KEY'
    });
    expect(JSON.stringify(saved)).not.toContain('sk-local-secret');
    expect(fetchImpl).toHaveBeenCalledWith('/api/settings/providers/openai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-next', apiKey: 'sk-local-secret' })
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/settings/model-routing/defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        draftingModel: 'gpt-draft-next',
        reviewModel: 'gpt-review-next',
        embeddingModel: 'text-embedding-3-large'
      })
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/settings/budgets/defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        maxRunCostUsd: 1.25,
        maxDailyCostUsd: 8.5,
        maxContextTokens: 24000
      })
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/settings/source-policy/defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowUserSamples: true,
        allowLicensedSamples: true,
        allowPublicDomain: false,
        restrictedSourceIds: ['private_archive']
      })
    });
  });
});

function mockSettingsClient(options: { rejectLoad?: boolean } = {}): SettingsApiClient {
  return {
    loadSettingsDefaults: async () => {
      if (options.rejectLoad) throw new Error('Settings unavailable');
      return {
        provider: {
          provider: 'openai',
          defaultModel: 'gpt-default',
          secretRef: 'env:OPENAI_API_KEY',
          redactedMetadata: {},
          updatedAt: '2026-04-27T00:00:00.000Z'
        },
        modelRouting: {
          provider: 'openai',
          draftingModel: 'gpt-draft',
          reviewModel: 'gpt-review',
          embeddingModel: 'text-embedding-3-small',
          updatedAt: '2026-04-27T00:00:00.000Z'
        },
        budget: {
          provider: 'openai',
          maxRunCostUsd: 0.5,
          maxDailyCostUsd: 5,
          maxContextTokens: 16000,
          updatedAt: '2026-04-27T00:00:00.000Z'
        },
        sourcePolicy: {
          allowUserSamples: true,
          allowLicensedSamples: false,
          allowPublicDomain: true,
          restrictedSourceIds: ['private_archive'],
          updatedAt: '2026-04-27T00:00:00.000Z'
        }
      };
    },
    saveProviderDefaults: async () => ({
      provider: 'openai',
      defaultModel: 'gpt-default',
      secretRef: 'env:OPENAI_API_KEY',
      redactedMetadata: { apiKey: '[redacted]' },
      updatedAt: '2026-04-27T00:00:00.000Z'
    }),
    saveModelRoutingDefaults: async (input) => ({
      provider: input.provider ?? 'openai',
      draftingModel: input.draftingModel,
      reviewModel: input.reviewModel,
      embeddingModel: input.embeddingModel,
      updatedAt: '2026-04-27T00:00:00.000Z'
    }),
    saveBudgetDefaults: async (input) => ({
      provider: input.provider ?? 'openai',
      maxRunCostUsd: input.maxRunCostUsd,
      maxDailyCostUsd: input.maxDailyCostUsd,
      maxContextTokens: input.maxContextTokens,
      updatedAt: '2026-04-27T00:00:00.000Z'
    }),
    saveSourcePolicyDefaults: async (input) => ({
      allowUserSamples: input.allowUserSamples ?? true,
      allowLicensedSamples: input.allowLicensedSamples ?? false,
      allowPublicDomain: input.allowPublicDomain ?? true,
      restrictedSourceIds: input.restrictedSourceIds ?? [],
      updatedAt: '2026-04-27T00:00:00.000Z'
    })
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
