import type { ProviderAdapter } from '@ai-novel/domain';
import { assertWithinBudget, estimatePromptTokens, type BudgetPolicy } from './budget-guard';
import { redactSecrets } from './redaction';

export interface LlmGatewayOptions {
  provider: ProviderAdapter;
  defaultModel: string;
  promptVersionId?: string;
  budget?: BudgetPolicy;
  budgetPolicy?: BudgetPolicy;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs?: number;
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
    let result: Awaited<ReturnType<ProviderAdapter['generateText']>>;
    let retryCount = 0;
    let lastUsage = this.estimatePreflightUsage(input.prompt);
    let spentUsd = 0;
    try {
      const executed = await this.withRetries({
        model,
        prompt: input.prompt,
        run: () =>
          this.options.provider.generateText({
            ...input,
            model
          })
      });
      result = executed.result;
      retryCount = executed.retryCount;
      lastUsage = result.usage;
      spentUsd = executed.spentUsd + this.estimateUsageCost(model, result.usage);
      this.assertRunCostWithinBudget(spentUsd);
    } catch (error) {
      const metadata = this.retryMetadata(error);
      retryCount = metadata.retryCount ?? retryCount;
      spentUsd = metadata.spentUsd ?? spentUsd;
      lastUsage = metadata.usage ?? lastUsage;
      const safeError = this.toSafeError(error);
      this.logCall({
        model,
        usage: lastUsage,
        durationMs: Date.now() - startedAt,
        retryCount,
        estimatedCostUsd: Math.max(spentUsd, this.estimateUsageCost(model, lastUsage)),
        status: 'Failed',
        error: safeError.message
      });
      throw safeError;
    }
    this.logCall({
      model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      retryCount,
      estimatedCostUsd: spentUsd,
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
    let transportRetryCount = 0;
    let spentUsd = 0;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let result: { value: T; usage: { inputTokens: number; outputTokens: number } };
      try {
        const executed = await this.withRetries({
          model,
          prompt,
          run: () =>
            this.options.provider.generateStructured<T>({
              prompt,
              schemaName: input.schemaName,
              model
            })
        });
        result = executed.result;
        transportRetryCount += executed.retryCount;
        spentUsd += executed.spentUsd + this.estimateUsageCost(model, result.usage);
        this.assertRunCostWithinBudget(spentUsd);
      } catch (error) {
        const metadata = this.retryMetadata(error);
        transportRetryCount += metadata.retryCount ?? 0;
        spentUsd += metadata.spentUsd ?? 0;
        preflightUsage = metadata.usage ?? preflightUsage;
        const safeError = this.toSafeError(error);
        this.logCall({
          model,
          schemaName: input.schemaName,
          usage: preflightUsage,
          durationMs: Date.now() - startedAt,
          retryCount: repairAttempts.length + transportRetryCount,
          estimatedCostUsd: Math.max(spentUsd, this.estimateUsageCost(model, preflightUsage)),
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
          retryCount: repairAttempts.length + transportRetryCount,
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
      defaultMaxOutputTokens === undefined || !this.budget
        ? this.budget
        : { ...this.budget, defaultMaxOutputTokens };
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
      outputTokens:
        defaultMaxOutputTokens ??
        (this.budget ? this.budget.defaultMaxOutputTokens ?? 1024 : 0)
    };
  }

  private formatError(error: unknown): string {
    return redactSecrets(error instanceof Error ? error.message : String(error)).replace(
      /\b(api_key|apiKey)(\s+)([A-Za-z0-9_-]{8,})\b/g,
      (_match, key, separator) => `${key}${separator}[REDACTED]`
    );
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
    estimatedCostUsd?: number;
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
      estimatedCostUsd: input.estimatedCostUsd ?? this.estimateUsageCost(input.model, input.usage),
      retryCount: input.retryCount ?? 0,
      status: input.status,
      error: input.error
    });
  }

  private get budget(): BudgetPolicy | undefined {
    return this.options.budgetPolicy ?? this.options.budget;
  }

  private async withRetries<T>(input: {
    model: string;
    prompt: string;
    run: () => Promise<{ usage: { inputTokens: number; outputTokens: number } } & T>;
  }): Promise<{ result: { usage: { inputTokens: number; outputTokens: number } } & T; retryCount: number; spentUsd: number }> {
    const maxAttempts = Math.max(1, this.options.retryPolicy?.maxAttempts ?? 1);
    let spentUsd = 0;
    let retryCount = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const preflightUsage = this.assertBudgetOnly(input.prompt, input.model);
      const preflightCost = this.estimateUsageCost(input.model, preflightUsage);
      try {
        const result = await input.run();
        return { result, retryCount, spentUsd };
      } catch (error) {
        spentUsd += preflightCost;
        if (attempt >= maxAttempts || !this.isTransientError(error)) {
          this.attachRetryMetadata(error, {
            retryCount,
            spentUsd,
            usage: preflightUsage
          });
          throw error;
        }
        retryCount += 1;
        this.assertRunCostWithinBudget(spentUsd);
        await this.delayForRetry(retryCount);
      }
    }

    throw new Error('LLM retry policy exhausted');
  }

  private assertRunCostWithinBudget(estimatedCostUsd: number): void {
    const budget = this.budget;
    if (!budget) return;
    if (estimatedCostUsd > budget.maxRunCostUsd) {
      throw new Error(
        `LLM budget exceeded: estimated ${estimatedCostUsd.toFixed(6)} USD exceeds ${budget.maxRunCostUsd.toFixed(6)} USD`
      );
    }
  }

  private assertBudgetOnly(
    prompt: string,
    model: string,
    defaultMaxOutputTokens?: number
  ): { inputTokens: number; outputTokens: number } {
    const usage = this.estimatePreflightUsage(prompt, defaultMaxOutputTokens);
    const budget =
      defaultMaxOutputTokens === undefined || !this.budget
        ? this.budget
        : { ...this.budget, defaultMaxOutputTokens };

    assertWithinBudget({
      prompt,
      model,
      budget,
      estimateCost: (estimate) => this.options.provider.estimateCost(estimate)
    });

    return usage;
  }

  private estimateUsageCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
    return this.options.provider.estimateCost({
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens
    }).estimatedUsd;
  }

  private isTransientError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : '';
    return (
      /(?:^|\D)(408|409|425|429|500|502|503|504)(?:\D|$)/.test(message) ||
      /timeout|timed out|abort/i.test(message) ||
      /TimeoutError|AbortError/i.test(name)
    );
  }

  private async delayForRetry(retryCount: number): Promise<void> {
    const baseDelayMs = this.options.retryPolicy?.baseDelayMs ?? 0;
    if (baseDelayMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** Math.max(0, retryCount - 1)));
  }

  private attachRetryMetadata(
    error: unknown,
    metadata: { retryCount: number; spentUsd: number; usage: { inputTokens: number; outputTokens: number } }
  ): void {
    if (error && (typeof error === 'object' || typeof error === 'function')) {
      Object.assign(error, { llmGatewayRetryMetadata: metadata });
    }
  }

  private retryMetadata(error: unknown):
    | { retryCount?: number; spentUsd?: number; usage?: { inputTokens: number; outputTokens: number } }
    | Record<string, never> {
    if (!error || (typeof error !== 'object' && typeof error !== 'function')) return {};
    const metadata = (error as { llmGatewayRetryMetadata?: unknown }).llmGatewayRetryMetadata;
    if (!metadata || typeof metadata !== 'object') return {};
    return metadata as { retryCount?: number; spentUsd?: number; usage?: { inputTokens: number; outputTokens: number } };
  }
}
