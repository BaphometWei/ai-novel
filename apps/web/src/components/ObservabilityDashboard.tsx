import {
  summarizeDataQualityIssues,
  summarizeObservability,
  summarizeWorkflowBottlenecks
} from '@ai-novel/evaluation';

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
const bottlenecks = summarizeWorkflowBottlenecks([
  { workflowType: 'draft', stepName: 'retrieve-context', durationMs: 1200, status: 'Succeeded', retryCount: 0 },
  { workflowType: 'draft', stepName: 'generate-draft', durationMs: 2600, status: 'Failed', retryCount: 2 },
  { workflowType: 'draft', stepName: 'generate-draft', durationMs: 3400, status: 'Succeeded', retryCount: 1 }
]);
const dataQuality = summarizeDataQualityIssues([
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
  }
]);

export function ObservabilityDashboard() {
  const primaryBottleneck = bottlenecks[0];
  const primaryError = summary.runErrors[0];

  return (
    <section className="surface-panel" aria-labelledby="observability-title">
      <header className="panel-header">
        <h2 id="observability-title">Observability</h2>
        <span>Agent runs</span>
      </header>
      <dl className="compact-list">
        <div>
          <dt>Cost</dt>
          <dd>${summary.totalCostUsd.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Model usage</dt>
          <dd>
            {summary.modelUsage.map((model) => (
              <span key={model.modelName}>{model.modelName}</span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Failure rate</dt>
          <dd>{Math.round(summary.failureRate * 100)}%</dd>
        </div>
        <div>
          <dt>Retries</dt>
          <dd>{summary.totalRetryCount}</dd>
        </div>
        <div>
          <dt>Context length</dt>
          <dd>{summary.averageContextLength.toLocaleString('en-US')} tokens avg</dd>
        </div>
        <div>
          <dt>Quality outcome</dt>
          <dd>accepted {summary.qualityOutcomes.accepted}</dd>
        </div>
        <div>
          <dt>User adoption</dt>
          <dd>adopted {summary.userAdoption.adopted}</dd>
        </div>
        <div>
          <dt>Run errors</dt>
          <dd>{primaryError ? `${primaryError.code} ${primaryError.count}` : 'none'}</dd>
        </div>
        <div>
          <dt>Workflow bottlenecks</dt>
          <dd>
            {primaryBottleneck
              ? `${primaryBottleneck.stepName} ${primaryBottleneck.averageDurationMs.toLocaleString('en-US')} ms avg`
              : 'none'}
          </dd>
        </div>
        <div>
          <dt>Data quality</dt>
          <dd>
            {dataQuality.openIssueCount} open, {dataQuality.highSeverityOpenCount} high
          </dd>
        </div>
      </dl>
    </section>
  );
}
