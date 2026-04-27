import type { ProviderAdapter } from '@ai-novel/domain';
import { assertWithinBudget, estimatePromptTokens, type BudgetPolicy } from './budget-guard';
import { redactSecrets } from './redaction';

export interface LlmGatewayOptions {
  provider: ProviderAdapter;
  defaultModel: string;
  promptVersionId?: string;
  budget?: BudgetPolicy;
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

  async generateText(input: { prompt: string; model?: string }) {
    const startedAt = Date.now();
    const model = input.model ?? this.options.defaultModel;
    const preflightUsage = this.assertWithinBudget(input.prompt, model);
    let result: Awaited<ReturnType<ProviderAdapter['generateText']>>;
    try {
      result = await this.options.provider.generateText({
        ...input,
        model
      });
    } catch (error) {
      const safeError = this.toSafeError(error);
      this.logCall({
        model,
        usage: preflightUsage,
        durationMs: Date.now() - startedAt,
        status: 'Failed',
        error: safeError.message
      });
      throw safeError;
    }
    this.logCall({
      model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: 'Succeeded'
    });
    return result;
  }

  async generateStructured<T>(input: {
    prompt: string;
    schemaName: string;
    model?: string;
    validate?: (value: unknown) => boolean;
  }) {
    const startedAt = Date.now();
    const model = input.model ?? this.options.defaultModel;
    let preflightUsage = this.assertWithinBudget(input.prompt, model);
    const repairAttempts: RepairAttempt[] = [];
    let lastUsage = { inputTokens: 0, outputTokens: 0 };
    let prompt = input.prompt;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let result: { value: T; usage: { inputTokens: number; outputTokens: number } };
      try {
        result = await this.options.provider.generateStructured<T>({
          prompt,
          schemaName: input.schemaName,
          model
        });
      } catch (error) {
        const safeError = this.toSafeError(error);
        this.logCall({
          model,
          schemaName: input.schemaName,
          usage: preflightUsage,
          durationMs: Date.now() - startedAt,
          retryCount: repairAttempts.length,
          status: 'Failed',
          error: safeError.message
        });
        throw safeError;
      }
      lastUsage = result.usage;
      const isValid = input.validate ? input.validate(result.value) : true;
      if (isValid) {
        this.logCall({
          model,
          schemaName: input.schemaName,
          usage: result.usage,
          durationMs: Date.now() - startedAt,
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
      preflightUsage = this.estimatePreflightUsage(prompt);
    }

    const error = `Structured output failed validation for ${input.schemaName}`;
    this.logCall({
      model,
      schemaName: input.schemaName,
      usage: lastUsage,
      durationMs: Date.now() - startedAt,
      retryCount: repairAttempts.length,
      status: 'Failed',
      error
    });
    throw new Error(error);
  }

  async *streamText(input: { prompt: string; model?: string }) {
    const startedAt = Date.now();
    const model = input.model ?? this.options.defaultModel;
    const preflightUsage = this.assertWithinBudget(input.prompt, model);
    let text = '';
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    try {
      for await (const chunk of this.options.provider.streamText({
        ...input,
        model
      })) {
        if (typeof chunk === 'string') {
          text += chunk;
          yield chunk;
        } else {
          text += chunk.text;
          usage = chunk.usage ?? usage;
          if (chunk.text) yield chunk.text;
        }
      }
    } catch (error) {
      const safeError = this.toSafeError(error);
      this.logCall({
        model,
        usage: usage ?? preflightUsage,
        durationMs: Date.now() - startedAt,
        status: 'Failed',
        error: safeError.message
      });
      throw safeError;
    }
    const finalUsage = usage ?? {
      inputTokens: estimatePromptTokens(input.prompt),
      outputTokens: estimatePromptTokens(text)
    };
    this.logCall({
      model,
      usage: finalUsage,
      durationMs: Date.now() - startedAt,
      status: 'Succeeded'
    });
  }

  async embedText(input: { text: string; model?: string }) {
    const startedAt = Date.now();
    const model = input.model ?? this.options.defaultModel;
    const preflightUsage = this.assertWithinBudget(input.text, model, 0);
    let result: Awaited<ReturnType<ProviderAdapter['embedText']>>;
    try {
      result = await this.options.provider.embedText({
        ...input,
        model
      });
    } catch (error) {
      const safeError = this.toSafeError(error);
      this.logCall({
        model,
        usage: preflightUsage,
        durationMs: Date.now() - startedAt,
        status: 'Failed',
        error: safeError.message
      });
      throw safeError;
    }
    this.logCall({
      model,
      usage: { inputTokens: estimatePromptTokens(input.text), outputTokens: 0 },
      durationMs: Date.now() - startedAt,
      status: 'Succeeded'
    });
    return result;
  }

  estimateCost(input: { model?: string; inputTokens: number; outputTokens: number }) {
    return this.options.provider.estimateCost({
      ...input,
      model: input.model ?? this.options.defaultModel
    });
  }

  private assertWithinBudget(
    prompt: string,
    model: string,
    defaultMaxOutputTokens?: number
  ): { inputTokens: number; outputTokens: number } {
    const usage = this.estimatePreflightUsage(prompt, defaultMaxOutputTokens);
    const budget =
      defaultMaxOutputTokens === undefined || !this.options.budget
        ? this.options.budget
        : { ...this.options.budget, defaultMaxOutputTokens };
    try {
      assertWithinBudget({
        prompt,
        model,
        budget,
        estimateCost: (estimate) => this.options.provider.estimateCost(estimate)
      });
    } catch (error) {
      const safeError = this.toSafeError(error);
      this.logCall({
        model,
        usage,
        durationMs: 0,
        status: 'Failed',
        error: safeError.message
      });
      throw safeError;
    }
    return usage;
  }

  private estimatePreflightUsage(prompt: string, defaultMaxOutputTokens?: number): {
    inputTokens: number;
    outputTokens: number;
  } {
    return {
      inputTokens: estimatePromptTokens(prompt),
      outputTokens: defaultMaxOutputTokens ?? (this.options.budget ? this.options.budget.defaultMaxOutputTokens ?? 1024 : 0)
    };
  }

  private formatError(error: unknown): string {
    return redactSecrets(error instanceof Error ? error.message : String(error));
  }

  private toSafeError(error: unknown): Error {
    return error instanceof Error
      ? new Error(this.formatError(error), { cause: error })
      : new Error(this.formatError(error));
  }

  private logCall(input: {
    model: string;
    schemaName?: string;
    usage: { inputTokens: number; outputTokens: number };
    durationMs: number;
    retryCount?: number;
    status: 'Succeeded' | 'Failed';
    error?: string;
  }) {
    this.callLog.push({
      promptVersionId: this.options.promptVersionId ?? 'unversioned',
      provider: this.options.provider.name ?? 'unknown',
      model: input.model,
      schemaName: input.schemaName,
      usage: input.usage,
      durationMs: input.durationMs,
      estimatedCostUsd: this.options.provider.estimateCost({
        model: input.model,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens
      }).estimatedUsd,
      retryCount: input.retryCount ?? 0,
      status: input.status,
      error: input.error
    });
  }
}
