export interface BudgetPolicy {
  maxRunCostUsd: number;
  defaultMaxOutputTokens?: number;
}

export interface BudgetEstimateInput {
  prompt: string;
  model: string;
  estimateCost: (input: { model: string; inputTokens: number; outputTokens: number }) => { estimatedUsd: number };
  budget?: BudgetPolicy;
}

export function estimatePromptTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function assertWithinBudget(input: BudgetEstimateInput): void {
  if (!input.budget) return;

  const estimated = input.estimateCost({
    model: input.model,
    inputTokens: estimatePromptTokens(input.prompt),
    outputTokens: input.budget.defaultMaxOutputTokens ?? 1024
  });

  if (estimated.estimatedUsd > input.budget.maxRunCostUsd) {
    throw new Error(
      `LLM budget exceeded: estimated ${estimated.estimatedUsd.toFixed(6)} USD exceeds ${input.budget.maxRunCostUsd.toFixed(6)} USD`
    );
  }
}
