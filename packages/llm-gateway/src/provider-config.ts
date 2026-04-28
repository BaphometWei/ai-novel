import { createEnvSecretStore, type ProviderSecretStore } from './secret-store';

export interface ProviderConfigInput {
  provider: string;
  defaultModel: string;
  secretRef: string;
  env?: Record<string, string | undefined>;
  secretStore?: ProviderSecretStore;
}

export interface ResolvedProviderConfig {
  provider: string;
  defaultModel: string;
  secretRef: string;
  apiKey: string;
}

export interface PublicProviderConfig {
  provider: string;
  defaultModel: string;
  secretRef: string;
  configured: boolean;
}

export function resolveProviderConfig(input: ProviderConfigInput): ResolvedProviderConfig {
  const secretStore = input.secretStore ?? createEnvSecretStore(input.env ?? {});
  const apiKey = secretStore.resolve(input.secretRef);
  if (!apiKey) {
    throw new Error(`Missing provider secret: ${input.secretRef}`);
  }

  return {
    provider: input.provider,
    defaultModel: input.defaultModel,
    secretRef: input.secretRef,
    apiKey
  };
}

export function toPublicProviderConfig(config: ResolvedProviderConfig): PublicProviderConfig {
  return {
    provider: config.provider,
    defaultModel: config.defaultModel,
    secretRef: config.secretRef,
    configured: config.apiKey.length > 0
  };
}
