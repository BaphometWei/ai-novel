import { describe, expect, it } from 'vitest';
import { createEnvSecretStore, type ProviderSecretStore } from './secret-store';
import { resolveProviderConfig, toPublicProviderConfig } from './provider-config';

describe('Provider config', () => {
  it('resolves env-backed secret refs for runtime provider creation without exposing raw keys publicly', () => {
    const config = resolveProviderConfig({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      secretStore: createEnvSecretStore({ OPENAI_API_KEY: 'sk-local-secret' })
    });

    expect(config).toMatchObject({
      provider: 'openai',
      defaultModel: 'gpt-test',
      apiKey: 'sk-local-secret'
    });
    expect(toPublicProviderConfig(config)).toEqual({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      configured: true
    });
    expect(JSON.stringify(toPublicProviderConfig(config))).not.toContain('sk-local-secret');
  });

  it('keeps env input compatibility by resolving through an env secret store', () => {
    const config = resolveProviderConfig({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      env: { OPENAI_API_KEY: 'sk-env-compat-secret' }
    });

    expect(config.apiKey).toBe('sk-env-compat-secret');
    expect(toPublicProviderConfig(config)).toEqual({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      configured: true
    });
  });

  it('reports missing env-backed secrets with the existing error wording', () => {
    expect(() =>
      resolveProviderConfig({
        provider: 'openai',
        defaultModel: 'gpt-test',
        secretRef: 'env:OPENAI_API_KEY',
        secretStore: createEnvSecretStore({})
      })
    ).toThrow('Missing provider secret: env:OPENAI_API_KEY');
  });

  it('reports unsupported secret refs with the existing error wording', () => {
    expect(() =>
      resolveProviderConfig({
        provider: 'openai',
        defaultModel: 'gpt-test',
        secretRef: 'vault:OPENAI_API_KEY',
        secretStore: createEnvSecretStore({})
      })
    ).toThrow('Unsupported provider secret reference: vault:OPENAI_API_KEY');
  });

  it('supports injected provider secret stores for runtime boundaries', () => {
    const seenRefs: string[] = [];
    const secretStore: ProviderSecretStore = {
      resolve(secretRef) {
        seenRefs.push(secretRef);
        return 'sk-injected-secret';
      }
    };

    const config = resolveProviderConfig({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'custom:openai',
      secretStore
    });

    expect(seenRefs).toEqual(['custom:openai']);
    expect(config.apiKey).toBe('sk-injected-secret');
    expect(toPublicProviderConfig(config).secretRef).toBe('custom:openai');
  });
});
