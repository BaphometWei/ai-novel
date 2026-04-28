import { useEffect, useMemo, useState } from 'react';
import type { ReviewFindingStatus, RevisionSuggestionStatus } from '@ai-novel/domain';
import type { ReviewApiClient, ReviewFinding, ReviewFindingActionKind, ReviewReport } from '../api/client';
import { RevisionDiff, type RevisionDiffSuggestion } from './RevisionDiff';

const baseSuggestion: Omit<RevisionDiffSuggestion, 'status'> = {
  title: 'Move secret use after reveal',
  rationale: 'Keeps the knowledge boundary intact.',
  before: 'Mira names the living bell before the reveal.',
  after: 'Mira hears the living bell but cannot name it yet.',
  risk: 'Medium'
};

export interface ReviewCenterProps {
  client?: ReviewApiClient;
  projectId?: string;
}

export function ReviewCenter({ client, projectId }: ReviewCenterProps = {}) {
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [findingStatus, setFindingStatus] = useState<ReviewFindingStatus>('Open');
  const [revisionStatus, setRevisionStatus] = useState<RevisionSuggestionStatus>('Proposed');
  const [explanationRequested, setExplanationRequested] = useState(false);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client || !projectId) {
      setReports([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    const apiClient = client;
    const activeProjectId = projectId;
    let mounted = true;

    async function loadReports() {
      setLoadError(null);
      setLoading(true);
      try {
        const loadedReports = await apiClient.listReviewReports(activeProjectId);
        if (!mounted) return;
        setReports(loadedReports);
        const firstFinding = loadedReports[0]?.findings[0];
        if (firstFinding) {
          setFindingStatus(firstFinding.status);
          setRevisionStatus(firstFinding.status === 'Applied' || firstFinding.status === 'Rejected' ? firstFinding.status : 'Proposed');
        }
      } catch (error) {
        if (mounted) setLoadError(error instanceof Error ? error.message : 'Unable to load review reports');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadReports();
    return () => {
      mounted = false;
    };
  }, [client, projectId]);

  const activeReport = reports[0];
  const activeFinding = activeReport?.findings[0];
  const demoMode = !client;
  const displayedFinding = activeFinding ?? (demoMode ? demoFinding() : null);
  const suggestion = useMemo(
    () => (displayedFinding ? suggestionFromFinding(displayedFinding) : null),
    [displayedFinding]
  );
  const qualityLabel = activeReport?.qualityScore.overall ?? (demoMode ? 76 : 'No data');

  async function decideRevision(action: ReviewFindingActionKind) {
    if (!displayedFinding) return;

    const localStatus = action === 'ApplyRevision' ? 'Applied' : action === 'Rejected' ? 'Rejected' : findingStatus;

    if (client && projectId && activeFinding) {
      try {
        const result = await client.recordReviewFindingAction(activeFinding.id, {
          projectId,
          action,
          decidedBy: 'operator'
        });
        setFindingStatus(result.nextStatus);
        if (result.nextStatus === 'Applied' || result.nextStatus === 'Rejected') setRevisionStatus(result.nextStatus);
        if (result.createdTaskId) setTaskTitle(result.createdTaskId);
        setActionMessage(`Action ${result.action} recorded.`);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to record review action');
      }
      return;
    }

    setFindingStatus(localStatus);
    if (localStatus === 'Applied' || localStatus === 'Rejected') setRevisionStatus(localStatus);
  }

  return (
    <section className="surface-panel" aria-labelledby="review-center-title">
      <header className="panel-header">
        <h2 id="review-center-title">Review Center</h2>
        <span>Quality {qualityLabel}</span>
      </header>
      {loadError ? <p role="alert">{loadError}</p> : null}
      {client && !projectId ? <p>No project available.</p> : null}
      {loading ? <p>Loading review reports...</p> : null}
      {client && projectId && !loading && !activeFinding && !loadError ? <p>No review findings yet.</p> : null}
      {displayedFinding && suggestion ? (
      <article className="review-finding">
        <h3>{displayedFinding.category || 'Continuity'} finding</h3>
        <p>{displayedFinding.problem}</p>
        <dl className="compact-list">
          <div>
            <dt>Evidence</dt>
            <dd>{displayedFinding.evidenceCitations[0]?.quote ?? 'Secret reveal occurs after the speaker uses it.'}</dd>
          </div>
          <div>
            <dt>Suggestion</dt>
            <dd>{displayedFinding.fixOptions[0] ?? 'Move the line after reveal or change speaker.'}</dd>
          </div>
        </dl>
        <p>Finding status: {findingStatus}</p>
        {explanationRequested ? <p>Explanation requested from Continuity Sentinel</p> : null}
        {taskTitle ? <p>Task created: {taskTitle}</p> : null}
        {actionMessage ? <p>{actionMessage}</p> : null}
        <RevisionDiff suggestion={{ ...suggestion, status: revisionStatus }} />
        <div className="button-row">
          <button type="button" onClick={() => void decideRevision('ApplyRevision')}>
            Apply
          </button>
          <button type="button" onClick={() => void decideRevision('Rejected')}>
            Reject
          </button>
          <button type="button" onClick={() => setExplanationRequested(true)}>
            Ask Why
          </button>
          <button
            type="button"
            onClick={() => {
              if (client && projectId && activeFinding) {
                void decideRevision('ConvertToTask');
              } else {
                setTaskTitle('Fix knowledge-boundary continuity issue');
              }
            }}
          >
            Convert to Task
          </button>
        </div>
      </article>
      ) : null}
    </section>
  );
}

function demoFinding(): ReviewFinding {
  return {
    id: 'review_finding_demo',
    manuscriptVersionId: 'chapter_12_demo',
    category: 'Continuity',
    severity: 'High',
    problem: 'High risk knowledge-boundary issue in chapter 12 draft.',
    evidenceCitations: [{ sourceId: 'chapter_12_demo', quote: 'Secret reveal occurs after the speaker uses it.' }],
    impact: 'Breaks reader knowledge boundaries.',
    fixOptions: ['Move the line after reveal or change speaker.'],
    autoFixRisk: 'Medium',
    status: 'Open'
  };
}

function suggestionFromFinding(finding: ReviewFinding): Omit<RevisionDiffSuggestion, 'status'> {
  if (finding.id === 'review_finding_demo') return baseSuggestion;

  return {
    title: finding.fixOptions[0] ?? baseSuggestion.title,
    rationale: finding.impact || baseSuggestion.rationale,
    before: finding.evidenceCitations[0]?.quote ?? baseSuggestion.before,
    after: finding.fixOptions[0] ?? baseSuggestion.after,
    risk: finding.autoFixRisk
  };
}
