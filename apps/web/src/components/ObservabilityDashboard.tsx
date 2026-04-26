import { summarizeObservability } from '@ai-novel/evaluation';

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

export function ObservabilityDashboard() {
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
      </dl>
    </section>
  );
}
