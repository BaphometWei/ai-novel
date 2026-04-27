export interface ProviderConfigInput {
  provider: string;
  defaultModel: string;
  secretRef: string;
  env?: Record<string, string | undefined>;
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
  const env = input.env ?? {};
  if (!input.secretRef.startsWith('env:')) {
    throw new Error(`Unsupported provider secret reference: ${input.secretRef}`);
  }

  const envName = input.secretRef.slice('env:'.length);
  const apiKey = env[envName];
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
