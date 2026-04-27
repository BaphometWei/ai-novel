import { describe, expect, it } from 'vitest';
import { resolveProviderConfig, toPublicProviderConfig } from './provider-config';

describe('Provider config', () => {
  it('resolves env-backed secret refs for runtime provider creation without exposing raw keys publicly', () => {
    const config = resolveProviderConfig({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      env: { OPENAI_API_KEY: 'sk-local-secret' }
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
});
