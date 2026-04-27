import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type RecurringIssueSummary,
  type ReviewFinding,
  type ReviewLearningApiClient,
  type RevisionRecheckResult
} from '../api/client';

const defaultPreviousManuscriptVersionId = 'chapter_1_v1';
const defaultCurrentManuscriptVersionId = 'chapter_1_v2';

export interface ReviewLearningPanelProps {
  client?: ReviewLearningApiClient;
  previousManuscriptVersionId?: string;
  currentManuscriptVersionId?: string;
  previousFindings?: ReviewFinding[];
  currentFindings?: ReviewFinding[];
}

export function ReviewLearningPanel({
  client,
  previousManuscriptVersionId = defaultPreviousManuscriptVersionId,
  currentManuscriptVersionId = defaultCurrentManuscriptVersionId,
  previousFindings = defaultPreviousFindings,
  currentFindings = defaultCurrentFindings
}: ReviewLearningPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [recurringIssues, setRecurringIssues] = useState<RecurringIssueSummary[]>([]);
  const [recheckResult, setRecheckResult] = useState<RevisionRecheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecurringIssues() {
      setLoading(true);
      setError(null);
      try {
        const result = await resolvedClient.summarizeRecurringIssues({ findings: currentFindings, minimumOccurrences: 2 });
        if (!cancelled) setRecurringIssues(result.recurringIssues);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load review learning');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRecurringIssues();

    return () => {
      cancelled = true;
    };
  }, [currentFindings, resolvedClient]);

  async function runRecheck() {
    setRechecking(true);
    setError(null);
    try {
      const result = await resolvedClient.recheckRevisionReview({
        checkedAt: new Date().toISOString(),
        previousManuscriptVersionId,
        currentManuscriptVersionId,
        previousFindings,
        currentFindings
      });
      setRecheckResult(result);
      setRecurringIssues(result.recurringIssues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to recheck revision');
    } finally {
      setRechecking(false);
    }
  }

  return (
    <section className="surface-panel" aria-labelledby="review-learning-title">
      <header className="panel-header">
        <h2 id="review-learning-title">Review Learning</h2>
        <span>
          {previousManuscriptVersionId} -&gt; {currentManuscriptVersionId}
        </span>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p>Loading review learning...</p> : null}

      <section className="work-surface" aria-label="Review learning actions">
        <button type="button" onClick={() => void runRecheck()} disabled={rechecking}>
          {rechecking ? 'Rechecking...' : 'Run recheck'}
        </button>
        {recheckResult ? <span>Regressions {recheckResult.regressions.length}</span> : null}
      </section>

      <div className="panel-grid">
        <section className="work-surface" aria-label="Recurring issue trends">
          <h3>Recurring Issues</h3>
          {!loading && recurringIssues.length === 0 ? <p>No recurring issues.</p> : null}
          <dl className="compact-list">
            {recurringIssues.map((issue) => (
              <div key={issue.signature}>
                <dt>{issue.signature}</dt>
                <dd>
                  <span>{issue.occurrenceCount} occurrences</span>
                  <span>{issue.trend}</span>
                  <span>{issue.risk} risk</span>
                  <span>{issue.chapterIds.join(', ')}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="work-surface" aria-label="Revision lifecycle statuses">
          <h3>Lifecycle</h3>
          {recheckResult ? (
            <dl className="compact-list">
              {recheckResult.statuses.map((status) => (
                <div key={status.findingId}>
                  <dt>{status.currentFindingId ? `${status.findingId} -> ${status.currentFindingId}` : status.findingId}</dt>
                  <dd>{status.status}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>No recheck run yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}

const defaultPreviousFindings: ReviewFinding[] = [
  createFinding({ id: 'review_finding_fixed', problem: 'Door opens twice', manuscriptVersionId: defaultPreviousManuscriptVersionId }),
  createFinding({ id: 'review_finding_open', problem: 'Motive is unclear', manuscriptVersionId: defaultPreviousManuscriptVersionId })
];

const defaultCurrentFindings: ReviewFinding[] = [
  createFinding({ id: 'review_finding_current', problem: 'Motive is unclear', manuscriptVersionId: defaultCurrentManuscriptVersionId })
];

function createFinding(overrides: Partial<ReviewFinding>): ReviewFinding {
  return {
    id: 'review_finding_1',
    manuscriptVersionId: defaultCurrentManuscriptVersionId,
    category: 'Continuity',
    severity: 'Medium',
    problem: 'Compass changes color',
    evidenceCitations: [{ sourceId: 'chapter_1', quote: 'The compass was brass.' }],
    impact: 'Reader cannot track the object.',
    fixOptions: ['Keep the compass brass.'],
    autoFixRisk: 'Low',
    status: 'Open',
    ...overrides
  };
}
