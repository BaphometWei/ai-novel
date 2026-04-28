import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type RetrievalEvaluationApiClient,
  type RetrievalProjectRegressionInput,
  type QualityThresholdConfig,
  type RetrievalRegressionResult
} from '../api/client';

export interface RetrievalEvaluationPanelProps {
  client?: RetrievalEvaluationApiClient;
  projectId?: string;
}

export function RetrievalEvaluationPanel({ client, projectId }: RetrievalEvaluationPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const activeProjectId = projectId ?? '';
  const hasProject = activeProjectId.trim().length > 0;
  const [passingResult, setPassingResult] = useState<RetrievalRegressionResult | null>(null);
  const [failingResult, setFailingResult] = useState<RetrievalRegressionResult | null>(null);
  const [thresholdConfig, setThresholdConfig] = useState<QualityThresholdConfig | null>(null);
  const [loading, setLoading] = useState(hasProject);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasProject) {
      setPassingResult(null);
      setFailingResult(null);
      setThresholdConfig(null);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const config = await resolvedClient.getQualityThresholds();
        const [passed, failed] = await Promise.all([
          resolvedClient.runProjectRetrievalRegression(activeProjectId, {
            ...passingInput,
            thresholds: config.retrieval
          }),
          resolvedClient.runProjectRetrievalRegression(activeProjectId, {
            ...failingInput,
            thresholds: config.retrieval
          })
        ]);
        if (!cancelled) {
          setThresholdConfig(config);
          setPassingResult(passed);
          setFailingResult(failed);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to run retrieval evaluation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, hasProject, resolvedClient]);

  return (
    <section className="surface-panel" aria-labelledby="retrieval-evaluation-title">
      <header className="panel-header">
        <h2 id="retrieval-evaluation-title">Retrieval Evaluation</h2>
        <span>Regression cases</span>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {!hasProject ? <p>No project available.</p> : null}
      {loading ? <p>Running retrieval regression...</p> : null}
      {thresholdConfig ? (
        <section className="work-surface" aria-label="Retrieval quality thresholds">
          <h3>Quality Thresholds</h3>
          <p>{thresholdConfig.source}</p>
          <p>Required coverage {formatPercent(thresholdConfig.retrieval.requiredCoverage)}</p>
          <p>Forbidden leakage {formatPercent(thresholdConfig.retrieval.forbiddenLeakage)}</p>
        </section>
      ) : null}

      <div className="panel-grid">
        <RetrievalCaseCard label="Passing retrieval case" result={passingResult} />
        <RetrievalCaseCard label="Failing retrieval case" result={failingResult} />
      </div>
    </section>
  );
}

function RetrievalCaseCard({ label, result }: { label: string; result: RetrievalRegressionResult | null }) {
  return (
    <section className="work-surface" aria-label={label}>
      <h3>{label.includes('Passing') ? 'Pass Case' : 'Failure Case'}</h3>
      {result ? (
        <dl className="compact-list">
          <div>
            <dt>{result.caseId}</dt>
            <dd>
              <span>{result.passed ? 'Passed' : 'Failed'}</span>
              <span>{result.summary.failureCount} failures</span>
            </dd>
          </div>
          <div>
            <dt>Included</dt>
            <dd>{result.included.map((item) => item.id).join(', ') || 'none'}</dd>
          </div>
          <div>
            <dt>Excluded</dt>
            <dd>{result.excluded.map((item) => item.id).join(', ') || 'none'}</dd>
          </div>
          <div>
            <dt>Thresholds</dt>
            <dd>{`required coverage ${formatPercent(result.thresholds.requiredCoverage)} / forbidden leakage ${formatPercent(
              result.thresholds.forbiddenLeakage
            )}`}</dd>
          </div>
          {result.triageHints.length > 0 ? (
            <div>
              <dt>Triage</dt>
              <dd>{result.triageHints.map((hint) => hint.message).join(' ')}</dd>
            </div>
          ) : null}
          {result.failures.map((failure) => (
            <div key={`${failure.kind}-${failure.id}`}>
              <dt>{failure.kind}</dt>
              <dd>{failure.message ?? `${failure.id} failure`}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const passingInput: RetrievalProjectRegressionInput = {
  caseId: 'case_retrieval_pass',
  query: 'archive door clue',
  policy: { id: 'policy_public_only', description: 'Keep restricted sources out of context.' },
  mustInclude: [{ id: 'scene_archive', text: 'Archive door clue' }],
  forbidden: [{ id: 'source_restricted_7', text: 'Restricted dossier' }]
};

const failingInput: RetrievalProjectRegressionInput = {
  ...passingInput,
  caseId: 'case_retrieval_fail',
  mustInclude: [{ id: 'scene_secret', text: 'Secret archive scene' }]
};
