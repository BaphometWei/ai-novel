import { describe, expect, it } from 'vitest';
import { createEvaluationCase, runEvaluationCases } from './evaluation-runner';
import { summarizeObservability } from './observability';

describe('evaluation runner', () => {
  it('reports missing must-have facts when a retrieval policy changes', async () => {
    const savedCase = createEvaluationCase({
      id: 'eval_secret_keeper',
      projectId: 'project_demo',
      query: 'who knows the river gate password',
      mustHaveFacts: [
        { id: 'fact_password', text: 'Only Lin Yun knows the river gate password.' },
        { id: 'fact_cost', text: 'Opening the river gate costs one memory.' }
      ]
    });

    const results = await runEvaluationCases({
      cases: [savedCase],
      retrievalPolicyId: 'policy_without_secret_costs',
      retrieve: async () => [
        {
          factId: 'fact_password',
          text: 'Only Lin Yun knows the river gate password.'
        }
      ]
    });

    expect(results[0]).toMatchObject({
      caseId: 'eval_secret_keeper',
      projectId: 'project_demo',
      retrievalPolicyId: 'policy_without_secret_costs',
      passed: false,
      missingMustHaveFacts: [{ id: 'fact_cost', text: 'Opening the river gate costs one memory.' }]
    });
  });

  it('summarizes AgentRun observability metrics for cost, reliability, context, quality, and adoption', () => {
    const summary = summarizeObservability([
      {
        id: 'run_writer_1',
        modelProvider: 'openai',
        modelName: 'gpt-5',
        costUsd: 1.25,
        tokens: { input: 1200, output: 800 },
        durationMs: 2400,
        retryCount: 1,
        contextLength: 9000,
        status: 'Succeeded',
        qualityOutcome: 'accepted',
        userAdoption: 'adopted'
      },
      {
        id: 'run_editor_1',
        modelProvider: 'openai',
        modelName: 'gpt-5-mini',
        costUsd: 0.5,
        tokens: { input: 700, output: 300 },
        durationMs: 1600,
        retryCount: 2,
        contextLength: 5000,
        status: 'Failed',
        qualityOutcome: 'needs_revision',
        userAdoption: 'rejected'
      }
    ]);

    expect(summary).toEqual({
      totalCostUsd: 1.75,
      totalTokens: 3000,
      averageDurationMs: 2000,
      failureRate: 0.5,
      totalRetryCount: 3,
      averageContextLength: 7000,
      modelUsage: [
        { modelProvider: 'openai', modelName: 'gpt-5', runCount: 1, totalTokens: 2000, totalCostUsd: 1.25 },
        { modelProvider: 'openai', modelName: 'gpt-5-mini', runCount: 1, totalTokens: 1000, totalCostUsd: 0.5 }
      ],
      qualityOutcomes: { accepted: 1, needs_revision: 1 },
      userAdoption: { adopted: 1, rejected: 1 }
    });
  });
});
