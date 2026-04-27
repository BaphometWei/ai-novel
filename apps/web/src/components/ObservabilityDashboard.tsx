import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type ObservabilityApiClient, type ProductObservabilitySummary } from '../api/client';

export interface ObservabilityDashboardProps {
  client?: ObservabilityApiClient;
}

export function ObservabilityDashboard({ client }: ObservabilityDashboardProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [summary, setSummary] = useState<ProductObservabilitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setError(null);
      try {
        const loaded = await resolvedClient.loadObservabilitySummary();
        if (!cancelled) setSummary(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load observability summary');
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [resolvedClient]);

  return (
    <section className="surface-panel" aria-labelledby="observability-title">
      <header className="panel-header">
        <h2 id="observability-title">Observability</h2>
        <span>Product summary</span>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      {!summary && !error ? <p>Loading observability...</p> : null}
      {summary ? <ObservabilitySummary summary={summary} /> : null}
    </section>
  );
}

function ObservabilitySummary({ summary }: { summary: ProductObservabilitySummary }) {
  const model = summary.modelUsage[0];
  const runError = summary.runErrors[0];
  const bottleneck = summary.workflowBottlenecks[0];
  const dataQuality = summary.dataQuality ?? summary.quality;

  return (
    <dl className="compact-list">
      <div>
        <dt>Cost</dt>
        <dd>
          <span>{formatUsd(summary.cost.totalUsd)}</span>
          <span>{formatUsd(summary.cost.averageUsdPerRun)}/run</span>
        </dd>
      </div>
      <div>
        <dt>Tokens</dt>
        <dd>
          <span>{formatInteger(summary.tokens.total)} total</span>
          <span>{formatInteger(summary.tokens.averagePerRun)}/run</span>
        </dd>
      </div>
      <div>
        <dt>Latency</dt>
        <dd>
          <span>{formatInteger(summary.latency.averageDurationMs)} ms avg</span>
          <span>{formatInteger(summary.latency.p95DurationMs)} ms p95</span>
        </dd>
      </div>
      <div>
        <dt>Quality</dt>
        <dd>
          <span>{formatPercent(summary.quality.acceptedRate)} accepted</span>
          <span>{formatOutcomes(summary.quality.outcomes)}</span>
        </dd>
      </div>
      <div>
        <dt>Adoption</dt>
        <dd>
          <span>{formatPercent(summary.adoption.adoptedRate)} adopted</span>
          <span>
            partial {formatPercent(summary.adoption.partialRate)}, rejected {formatPercent(summary.adoption.rejectedRate)}
          </span>
        </dd>
      </div>
      {model ? (
        <div>
          <dt>Model usage</dt>
          <dd>{model.modelName} {formatInteger(model.runCount)} runs</dd>
        </div>
      ) : null}
      {runError ? (
        <div>
          <dt>Run errors</dt>
          <dd>
            {runError.code} {formatInteger(runError.count)} retryable {formatInteger(runError.retryableCount)}
          </dd>
        </div>
      ) : null}
      {bottleneck ? (
        <div>
          <dt>Workflow bottlenecks</dt>
          <dd>
            {bottleneck.stepName} {formatInteger(bottleneck.averageDurationMs)} ms avg
          </dd>
        </div>
      ) : null}
      <div>
        <dt>Data quality</dt>
        <dd>
          {formatInteger(dataQuality.openIssueCount)} open, {formatInteger(dataQuality.highSeverityOpenCount)} high
        </dd>
      </div>
    </dl>
  );
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatOutcomes(outcomes: Record<string, number>): string {
  const entries = Object.entries(outcomes);
  return entries.length > 0 ? entries.map(([key, value]) => `${key} ${formatInteger(value)}`).join(', ') : 'none';
}
