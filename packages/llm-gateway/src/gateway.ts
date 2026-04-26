import type { ProviderAdapter } from '@ai-novel/domain';

export interface LlmGatewayOptions {
  provider: ProviderAdapter;
  defaultModel: string;
}

export class LlmGateway {
  constructor(private readonly options: LlmGatewayOptions) {}

  generateText(input: { prompt: string; model?: string }) {
    return this.options.provider.generateText({
      ...input,
      model: input.model ?? this.options.defaultModel
    });
  }

  generateStructured<T>(input: { prompt: string; schemaName: string; model?: string }) {
    return this.options.provider.generateStructured<T>({
      ...input,
      model: input.model ?? this.options.defaultModel
    });
  }

  streamText(input: { prompt: string; model?: string }) {
    return this.options.provider.streamText({
      ...input,
      model: input.model ?? this.options.defaultModel
    });
  }

  embedText(input: { text: string; model?: string }) {
    return this.options.provider.embedText({
      ...input,
      model: input.model ?? this.options.defaultModel
    });
  }

  estimateCost(input: { model?: string; inputTokens: number; outputTokens: number }) {
    return this.options.provider.estimateCost({
      ...input,
      model: input.model ?? this.options.defaultModel
    });
  }
}
