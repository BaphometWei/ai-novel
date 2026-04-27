import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type NarrativeIntelligenceApiClient,
  type NarrativeIntelligenceSummary
} from '../api/client';

export interface NarrativeIntelligencePanelProps {
  client?: NarrativeIntelligenceApiClient;
  projectId?: string;
  currentChapter?: number;
}

export function NarrativeIntelligencePanel({
  client,
  projectId,
  currentChapter = 7
}: NarrativeIntelligencePanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const activeProjectId = projectId ?? '';
  const hasProject = activeProjectId.trim().length > 0;
  const [summary, setSummary] = useState<NarrativeIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(hasProject);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasProject) {
      setSummary(null);
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
        const nextSummary = await resolvedClient.getNarrativeIntelligenceSummary(activeProjectId, { currentChapter });
        if (!cancelled) {
          setSummary(nextSummary);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load narrative intelligence');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, currentChapter, hasProject, resolvedClient]);

  const promiseState = summary?.promiseStates[0] ?? null;
  const closureResult = summary?.closure ?? null;

  return (
    <section className="surface-panel" aria-labelledby="narrative-intelligence-title">
      <header className="panel-header">
        <h2 id="narrative-intelligence-title">Narrative Intelligence</h2>
        <span>Promise and closure scan</span>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {!hasProject ? <p>No project available.</p> : null}
      {loading ? <p>Loading narrative intelligence...</p> : null}

      <div className="panel-grid">
        <section className="work-surface" aria-label="Reader promise readiness">
          <h3>Promise Readiness</h3>
          {promiseState ? (
            <dl className="compact-list">
              <div>
                <dt>{promiseState.title || promiseState.id || 'Reader promise'}</dt>
                <dd>
                  <span>{promiseState.health}</span>
                  <span>{displayRecommendation(promiseState.recommendation)}</span>
                  <span>{displayUiState(promiseState.uiState)}</span>
                </dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="work-surface" aria-label="Closure blockers">
          <h3>Closure Blockers</h3>
          {closureResult ? (
            <>
              <p>{closureResult.blockerCount} blockers</p>
              <dl className="compact-list">
                {closureResult.blockers.map((blocker) => (
                  <div key={String(blocker.id ?? blocker.label)}>
                    <dt>{String(blocker.label ?? blocker.id ?? 'Blocker')}</dt>
                    <dd>{String(blocker.reason ?? blocker.type ?? '')}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function displayRecommendation(recommendation: Record<string, unknown>): string {
  return String(recommendation.label ?? recommendation.action ?? 'No action');
}

function displayUiState(uiState: NarrativeIntelligenceSummary['promiseStates'][number]['uiState']): string {
  if (typeof uiState === 'string') return uiState;
  return String(uiState.summary ?? uiState.statusLabel ?? '');
}
