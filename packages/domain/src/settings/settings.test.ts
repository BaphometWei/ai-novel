import { describe, expect, it } from 'vitest';
import {
  createBudgetDefaults,
  createModelRoutingDefaults,
  createProviderDefaults,
  createSourcePolicyDefaults,
  redactSettingsSecrets
} from './settings';

describe('settings domain model', () => {
  it('stores provider defaults with local secret references and redacted metadata', () => {
    const settings = createProviderDefaults({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-local-secret',
      metadata: {
        organization: 'org_test',
        nested: { accessToken: 'token-secret' }
      },
      updatedAt: '2026-04-27T00:00:00.000Z'
    });

    expect(settings).toEqual({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      redactedMetadata: {
        organization: 'org_test',
        nested: { accessToken: '[redacted]' }
      },
      updatedAt: '2026-04-27T00:00:00.000Z'
    });
    expect(redactSettingsSecrets({ apiKey: 'sk-local-secret' })).toEqual({ apiKey: '[redacted]' });
  });

  it('normalizes model routing, budget, and source-policy defaults', () => {
    expect(
      createModelRoutingDefaults({
        provider: 'openai',
        draftingModel: 'gpt-draft',
        reviewModel: 'gpt-review',
        embeddingModel: 'text-embedding-test'
      })
    ).toMatchObject({
      provider: 'openai',
      draftingModel: 'gpt-draft',
      reviewModel: 'gpt-review',
      embeddingModel: 'text-embedding-test'
    });
    expect(createBudgetDefaults({ provider: 'openai', maxRunCostUsd: 0.25, maxContextTokens: 12000 })).toMatchObject({
      provider: 'openai',
      maxRunCostUsd: 0.25,
      maxContextTokens: 12000
    });
    expect(createSourcePolicyDefaults({ allowUserSamples: true, allowLicensedSamples: false })).toMatchObject({
      allowUserSamples: true,
      allowLicensedSamples: false,
      allowPublicDomain: true,
      restrictedSourceIds: []
    });
  });
});
