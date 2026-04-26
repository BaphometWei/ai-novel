import type { ProviderAdapter } from '@ai-novel/domain';

export interface LlmGatewayOptions {
  provider: ProviderAdapter;
  defaultModel: string;
  promptVersionId?: string;
}

export interface RepairAttempt {
  attempt: number;
  reason: string;
}

export interface LlmCallLogEntry {
  promptVersionId: string;
  provider: string;
  model: string;
  schemaName?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  durationMs: number;
  estimatedCostUsd: number;
  retryCount: number;
  status: 'Succeeded' | 'Failed';
  error?: string;
}

export class LlmGateway {
  readonly callLog: LlmCallLogEntry[] = [];

  constructor(private readonly options: LlmGatewayOptions) {}

  generateText(input: { prompt: string; model?: string }) {
    return this.options.provider.generateText({
      ...input,
      model: input.model ?? this.options.defaultModel
    });
  }

  async generateStructured<T>(input: {
    prompt: string;
    schemaName: string;
    model?: string;
    validate?: (value: unknown) => boolean;
  }) {
    const startedAt = Date.now();
    const model = input.model ?? this.options.defaultModel;
    const repairAttempts: RepairAttempt[] = [];
    let lastUsage = { inputTokens: 0, outputTokens: 0 };
    let prompt = input.prompt;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await this.options.provider.generateStructured<T>({
        prompt,
        schemaName: input.schemaName,
        model
      });
      lastUsage = result.usage;
      const isValid = input.validate ? input.validate(result.value) : true;
      if (isValid) {
        this.callLog.push({
          promptVersionId: this.options.promptVersionId ?? 'unversioned',
          provider: this.options.provider.name ?? 'unknown',
          model,
          schemaName: input.schemaName,
          usage: result.usage,
          durationMs: Date.now() - startedAt,
          estimatedCostUsd: this.options.provider.estimateCost({
            model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens
          }).estimatedUsd,
          retryCount: repairAttempts.length,
          status: 'Succeeded'
        });
        return {
          ...result,
          repairAttempts
        };
      }

      repairAttempts.push({
        attempt: attempt + 1,
        reason: `Schema validation failed for ${input.schemaName}`
      });
      prompt = [
        `Repair structured output for ${input.schemaName}.`,
        `Validation error: ${repairAttempts[repairAttempts.length - 1]?.reason}.`,
        `Original prompt: ${input.prompt}`
      ].join('\n');
    }

    const error = `Structured output failed validation for ${input.schemaName}`;
    this.callLog.push({
      promptVersionId: this.options.promptVersionId ?? 'unversioned',
      provider: this.options.provider.name ?? 'unknown',
      model,
      schemaName: input.schemaName,
      usage: lastUsage,
      durationMs: Date.now() - startedAt,
      estimatedCostUsd: this.options.provider.estimateCost({
        model,
        inputTokens: lastUsage.inputTokens,
        outputTokens: lastUsage.outputTokens
      }).estimatedUsd,
      retryCount: repairAttempts.length,
      status: 'Failed',
      error
    });
    throw new Error(error);
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
