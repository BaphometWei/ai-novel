const REDACTED_VALUE = '[redacted]';
const SECRET_KEYS = new Set(['apikey', 'secret', 'token', 'accesstoken', 'refreshtoken']);

export interface ProviderDefaults {
  provider: string;
  defaultModel: string;
  secretRef: string;
  redactedMetadata: Record<string, unknown>;
  updatedAt: string;
}

export interface ModelRoutingDefaults {
  provider: string;
  draftingModel: string;
  reviewModel: string;
  embeddingModel?: string;
  updatedAt: string;
}

export interface BudgetDefaults {
  provider: string;
  maxRunCostUsd: number;
  maxDailyCostUsd?: number;
  maxContextTokens?: number;
  updatedAt: string;
}

export interface SourcePolicyDefaults {
  allowUserSamples: boolean;
  allowLicensedSamples: boolean;
  allowPublicDomain: boolean;
  restrictedSourceIds: string[];
  updatedAt: string;
}

export function createProviderDefaults(input: {
  provider: string;
  model: string;
  apiKey?: string;
  secretRef?: string;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}): ProviderDefaults {
  return {
    provider: input.provider,
    defaultModel: input.model,
    secretRef: input.secretRef ?? providerEnvSecretRef(input.provider),
    redactedMetadata: redactSettingsSecrets(input.metadata ?? {}) as Record<string, unknown>,
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function createModelRoutingDefaults(input: {
  provider?: string;
  draftingModel: string;
  reviewModel: string;
  embeddingModel?: string;
  updatedAt?: string;
}): ModelRoutingDefaults {
  return {
    provider: input.provider ?? 'openai',
    draftingModel: input.draftingModel,
    reviewModel: input.reviewModel,
    ...(input.embeddingModel === undefined ? {} : { embeddingModel: input.embeddingModel }),
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function createBudgetDefaults(input: {
  provider?: string;
  maxRunCostUsd: number;
  maxDailyCostUsd?: number;
  maxContextTokens?: number;
  updatedAt?: string;
}): BudgetDefaults {
  return {
    provider: input.provider ?? 'openai',
    maxRunCostUsd: input.maxRunCostUsd,
    ...(input.maxDailyCostUsd === undefined ? {} : { maxDailyCostUsd: input.maxDailyCostUsd }),
    ...(input.maxContextTokens === undefined ? {} : { maxContextTokens: input.maxContextTokens }),
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function createSourcePolicyDefaults(input: {
  allowUserSamples?: boolean;
  allowLicensedSamples?: boolean;
  allowPublicDomain?: boolean;
  restrictedSourceIds?: string[];
  updatedAt?: string;
}): SourcePolicyDefaults {
  return {
    allowUserSamples: input.allowUserSamples ?? true,
    allowLicensedSamples: input.allowLicensedSamples ?? false,
    allowPublicDomain: input.allowPublicDomain ?? true,
    restrictedSourceIds: [...(input.restrictedSourceIds ?? [])],
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function providerEnvSecretRef(provider: string): string {
  return `env:${provider.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_API_KEY`;
}

export function redactSettingsSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSettingsSecrets(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        isSecretKey(key) ? REDACTED_VALUE : redactSettingsSecrets(child)
      ])
    ) as T;
  }

  return value;
}

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
}
