import type { BudgetPolicy, ProviderSettings, SettingsRepository } from '@ai-novel/db';
import type { ProviderAdapter } from '@ai-novel/domain';
import {
  createFakeProvider,
  createEnvSecretStore,
  createOpenAIProvider,
  estimatePromptTokens,
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
  inspectSend(input: {
    promptVersionId: string;
    prompt: string;
    allowExternalModel?: boolean;
    defaultMaxOutputTokens?: number;
  }): Promise<ProviderSendInspection>;
}

export interface ProviderSendInspection {
  provider: string;
  model: string;
  isExternal: boolean;
  secretConfigured: boolean;
  budgetEstimate: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    maxRunCostUsd?: number;
  };
  warnings: string[];
  blockingReasons: string[];
}

export async function createProviderRuntime(
  settings: SettingsRepository,
  options: ProviderRuntimeOptions = {}
): Promise<ProviderRuntime> {
  return {
    async inspectSend({ prompt, allowExternalModel = true, defaultMaxOutputTokens }) {
      const openAISettings = await settings.findProviderSettings('openai');
      const openAIBudget = await settings.findBudgetPolicy('openai');
      const isExternal = isExternalProvider(openAISettings);
      const provider = openAISettings?.provider ?? options.fallbackProvider?.name ?? 'fake';
      const model = openAISettings?.defaultModel ?? 'fake-model';
      const inputTokens = estimatePromptTokens(prompt);
      const outputTokens = defaultMaxOutputTokens ?? (openAIBudget ? 1024 : 0);
      const estimatedCostUsd = estimateProviderCost({
        provider,
        model,
        inputTokens,
        outputTokens,
        fallbackProvider: options.fallbackProvider
      });
      const secretConfigured = isExternal ? hasConfiguredSecret(openAISettings, options) : true;
      const warnings: string[] = [];
      const blockingReasons: string[] = [];

      if (isExternal && !allowExternalModel) {
        blockingReasons.push('External model use is disabled for this project');
      }
      if (isExternal && !secretConfigured) {
        blockingReasons.push(`Missing provider secret: ${openAISettings?.secretRef ?? 'unknown'}`);
      }
      if (openAIBudget && estimatedCostUsd > openAIBudget.maxRunCostUsd) {
        blockingReasons.push(
          `LLM budget exceeded: estimated ${estimatedCostUsd.toFixed(6)} USD exceeds ${openAIBudget.maxRunCostUsd.toFixed(6)} USD`
        );
      }
      if (isExternal && blockingReasons.length === 0) {
        warnings.push('External model call requires pre-send confirmation');
      }

      return {
        provider,
        model,
        isExternal,
        secretConfigured,
        budgetEstimate: {
          inputTokens,
          outputTokens,
          estimatedCostUsd,
          ...(openAIBudget ? { maxRunCostUsd: openAIBudget.maxRunCostUsd } : {})
        },
        warnings,
        blockingReasons
      };
    },
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

function hasConfiguredSecret(settings: ProviderSettings | null, options: ProviderRuntimeOptions): boolean {
  if (!settings?.secretRef) return false;
  try {
    return Boolean(createEnvSecretStore(options.env ?? process.env).resolve(settings.secretRef));
  } catch {
    return false;
  }
}

function estimateProviderCost(input: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  fallbackProvider?: ProviderAdapter;
}): number {
  if (input.provider === 'openai') {
    return (input.inputTokens / 1_000_000) * 5 + (input.outputTokens / 1_000_000) * 15;
  }

  return (
    input.fallbackProvider?.estimateCost({
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens
    }).estimatedUsd ?? 0
  );
}
