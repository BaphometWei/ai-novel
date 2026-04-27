import { describe, expect, it } from 'vitest';
import { createEvaluationCase, runEvaluationCases } from './evaluation-runner';
import {
  aggregateProductObservability,
  summarizeDataQualityIssues,
  summarizeObservability,
  summarizeWorkflowBottlenecks
} from './observability';

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
        userAdoption: 'rejected',
        errors: [
          {
            id: 'error_schema_1',
            code: 'schema_validation',
            message: 'Structured output failed validation',
            severity: 'Error',
            retryable: true,
            occurredAt: '2026-04-27T00:00:00.000Z'
          }
        ]
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
      userAdoption: { adopted: 1, rejected: 1 },
      runErrors: [{ code: 'schema_validation', count: 1, retryableCount: 1, maxSeverity: 'Error' }]
    });
  });

  it('aggregates product observability from runs, quality issues, and adoption events', () => {
    const summary = aggregateProductObservability({
      runs: [
        {
          id: 'run_writer_1',
          modelProvider: 'openai',
          modelName: 'gpt-5',
          costUsd: 1.2,
          tokens: { input: 1000, output: 500 },
          durationMs: 2000,
          retryCount: 0,
          contextLength: 8000,
          status: 'Succeeded',
          qualityOutcome: 'accepted',
          userAdoption: 'adopted'
        },
        {
          id: 'run_editor_1',
          modelProvider: 'openai',
          modelName: 'gpt-5-mini',
          costUsd: 0.3,
          tokens: { input: 400, output: 100 },
          durationMs: 1000,
          retryCount: 1,
          contextLength: 3000,
          status: 'Succeeded',
          qualityOutcome: 'needs_revision',
          userAdoption: 'partial'
        }
      ],
      qualityIssues: [
        {
          id: 'issue_1',
          projectId: 'project_1',
          source: 'agent_run',
          severity: 'High',
          status: 'Open',
          message: 'Bad continuity handoff'
        }
      ],
      adoptionEvents: [
        { feature: 'chapter_plan', outcome: 'adopted' },
        { feature: 'chapter_plan', outcome: 'partial' },
        { feature: 'review_fix', outcome: 'rejected' }
      ]
    });

    expect(summary).toEqual({
      cost: { totalUsd: 1.5, averageUsdPerRun: 0.75 },
      latency: { averageDurationMs: 1500, p95DurationMs: 2000 },
      tokens: { total: 2000, averagePerRun: 1000 },
      quality: { acceptedRate: 0.5, openIssueCount: 1, highSeverityOpenCount: 1, outcomes: { accepted: 1, needs_revision: 1 } },
      adoption: {
        adoptedRate: 1 / 3,
        partialRate: 1 / 3,
        rejectedRate: 1 / 3,
        byFeature: {
          chapter_plan: { adopted: 1, partial: 1, rejected: 0 },
          review_fix: { adopted: 0, partial: 0, rejected: 1 }
        }
      }
    });
  });

  it('summarizes workflow bottlenecks from step telemetry', () => {
    const report = summarizeWorkflowBottlenecks([
      { workflowType: 'draft', stepName: 'retrieve-context', durationMs: 1200, status: 'Succeeded', retryCount: 0 },
      { workflowType: 'draft', stepName: 'generate-draft', durationMs: 2600, status: 'Failed', retryCount: 2 },
      { workflowType: 'draft', stepName: 'generate-draft', durationMs: 3400, status: 'Succeeded', retryCount: 1 }
    ]);

    expect(report).toEqual([
      {
        workflowType: 'draft',
        stepName: 'generate-draft',
        runCount: 2,
        averageDurationMs: 3000,
        failureRate: 0.5,
        retryPressure: 3
      },
      {
        workflowType: 'draft',
        stepName: 'retrieve-context',
        runCount: 1,
        averageDurationMs: 1200,
        failureRate: 0,
        retryPressure: 0
      }
    ]);
  });

  it('summarizes open data-quality issues by source and severity', () => {
    const summary = summarizeDataQualityIssues([
      {
        id: 'issue_canon_1',
        projectId: 'project_demo',
        source: 'canon',
        severity: 'High',
        status: 'Open',
        message: 'Canon fact has no confirmation trail'
      },
      {
        id: 'issue_knowledge_1',
        projectId: 'project_demo',
        source: 'knowledge',
        severity: 'Medium',
        status: 'Open',
        message: 'Knowledge item missing source policy'
      },
      {
        id: 'issue_run_1',
        projectId: 'project_demo',
        source: 'agent_run',
        severity: 'Low',
        status: 'Resolved',
        message: 'Transient run warning'
      }
    ]);

    expect(summary).toEqual({
      openIssueCount: 2,
      highSeverityOpenCount: 1,
      bySource: { canon: 1, knowledge: 1 },
      bySeverity: { High: 1, Medium: 1 },
      unresolved: [
        expect.objectContaining({ id: 'issue_canon_1', source: 'canon' }),
        expect.objectContaining({ id: 'issue_knowledge_1', source: 'knowledge' })
      ]
    });
  });
});
