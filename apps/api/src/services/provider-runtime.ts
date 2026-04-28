import type { BudgetPolicy, ProviderSettings, SettingsRepository } from '@ai-novel/db';
import type { ProviderAdapter } from '@ai-novel/domain';
import {
  createFakeProvider,
  createEnvSecretStore,
  createOpenAIProvider,
  LlmGateway,
  resolveProviderConfig,
  type LlmGatewayOptions
} from '@ai-novel/llm-gateway';

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface ProviderRuntimeOptions {
  env?: Record<string, string | undefined>;
  fetch?: FetchLike;
  fallbackProvider?: ProviderAdapter;
}

export interface ProviderRuntime {
  createGateway(input: { promptVersionId: string; allowExternalModel?: boolean }): Promise<LlmGateway>;
}

export async function createProviderRuntime(
  settings: SettingsRepository,
  options: ProviderRuntimeOptions = {}
): Promise<ProviderRuntime> {
  return {
    async createGateway({ promptVersionId, allowExternalModel = true }) {
      const openAISettings = await settings.findProviderSettings('openai');
      const openAIBudget = await settings.findBudgetPolicy('openai');
      if (isExternalProvider(openAISettings) && !allowExternalModel) {
        throw new Error('External model use is disabled for this project');
      }
      const gatewayOptions = createConfiguredGatewayOptions(openAISettings, openAIBudget, options);

      return new LlmGateway({
        ...gatewayOptions,
        promptVersionId
      });
    }
  };
}

function isExternalProvider(settings: ProviderSettings | null): boolean {
  return Boolean(settings && settings.provider !== 'fake');
}

function createConfiguredGatewayOptions(
  settings: ProviderSettings | null,
  budgetPolicy: BudgetPolicy | null,
  options: ProviderRuntimeOptions
): Omit<LlmGatewayOptions, 'promptVersionId'> {
  if (settings?.provider === 'openai') {
    const resolved = resolveProviderConfig({
      provider: settings.provider,
      defaultModel: settings.defaultModel,
      secretRef: settings.secretRef,
      secretStore: createEnvSecretStore(options.env ?? process.env)
    });
    return {
      provider: createOpenAIProvider({
        apiKey: resolved.apiKey,
        fetch: options.fetch
      }),
      defaultModel: resolved.defaultModel,
      budget: budgetPolicy ? { maxRunCostUsd: budgetPolicy.maxRunCostUsd } : undefined
    };
  }

  return {
    provider: options.fallbackProvider ?? createDefaultFakeProvider(),
    defaultModel: 'fake-model'
  };
}

function createDefaultFakeProvider(): ProviderAdapter {
  return createFakeProvider({
    text: 'Deterministic writing draft',
    structured: {
      title: 'Deterministic chapter plan',
      nextAction: 'Review the plan with the author'
    },
    embedding: [],
    usage: { inputTokens: 120, outputTokens: 40 }
  });
}
