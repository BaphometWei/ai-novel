import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type ApiClient,
  type ChapterSummary,
  type ProjectSummary,
  type GlobalSearchInput,
  type GlobalSearchResult,
  type SearchApiClient,
  type ApprovalItem,
  type ApprovalsApiClient
} from '../api/client';

const stats = [
  { label: 'Draft Chapters', value: '0' },
  { label: 'Active Promises', value: '0' },
  { label: 'Canon Conflicts', value: '0' },
  { label: 'Open Reviews', value: '0' }
];

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; project: ProjectSummary | null; chapters: ChapterSummary[] };

export interface ProjectDashboardProps {
  client?: ApiClient & Partial<SearchApiClient> & Partial<ApprovalsApiClient>;
  onProjectLoaded?: (project: ProjectSummary | null) => void;
}

export function ProjectDashboard({ client, onProjectLoaded }: ProjectDashboardProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const projects = await resolvedClient.listProjects();
        const currentProject = projects[0];
        if (!currentProject) {
          if (isMounted) {
            setState({ status: 'loaded', project: null, chapters: [] });
            onProjectLoaded?.(null);
          }
          return;
        }

        const [project, chapters] = await Promise.all([
          resolvedClient.getProjectSummary(currentProject.id),
          resolvedClient.listProjectChapters(currentProject.id)
        ]);
        if (isMounted) {
          setState({ status: 'loaded', project, chapters });
          onProjectLoaded?.(project);
        }
      } catch (error) {
        if (isMounted) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown API error'
          });
          onProjectLoaded?.(null);
        }
      }
    }

    async function loadApprovals() {
      try {
        if ('listPendingApprovals' in resolvedClient) {
          const items = await (resolvedClient as ApprovalsApiClient).listPendingApprovals();
          if (isMounted) setApprovals(items);
        }
      } catch (err) {
        // ignore
      }
    }

    void loadDashboard();
    void loadApprovals();

    return () => {
      isMounted = false;
    };
  }, [onProjectLoaded, resolvedClient]);

  const loadedProject = state.status === 'loaded' ? state.project : null;
  const chapterCount = state.status === 'loaded' ? state.chapters.length : 0;
  const renderedStats = stats.map((stat) =>
    stat.label === 'Draft Chapters' ? { ...stat, value: String(chapterCount) } : stat
  );

  return (
    <section className="dashboard-panel" aria-labelledby="current-project">
      <header className="workspace-header">
        <p>Current Project</p>
        <h2 id="current-project">{loadedProject?.title ?? 'Writing Cockpit'}</h2>
      </header>
      <section className="work-surface" aria-label="Global search">
        <label>
          Global search
          <input
            aria-label="Global search input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                void (async () => {
                  try {
                    if ('globalSearch' in resolvedClient) {
                      const searchInput: GlobalSearchInput = { projectId: loadedProject?.id ?? '', query: searchQuery };
                      const results = await (resolvedClient as SearchApiClient).globalSearch(searchInput);
                      setSearchResults(results);
                    }
                  } catch (_) {
                    setSearchResults([]);
                  }
                })();
              }
            }}
          />
        </label>
        <div aria-label="Global search results">
          {searchResults.length === 0 ? <p>No results.</p> : null}
          {searchResults.map((r) => (
            <article key={r.id}>
              <strong>{r.title}</strong>
              <p>{r.snippet}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="work-surface" aria-label="Approvals queue">
        <h3>Approvals Queue</h3>
        {approvals.length === 0 ? <p>No pending approvals.</p> : null}
        <ul>
          {approvals.map((a) => (
            <li key={a.id}>{a.title} — {a.status}</li>
          ))}
        </ul>
      </section>
      {state.status === 'loading' ? <p>Loading project...</p> : null}
      {state.status === 'error' ? (
        <section className="work-surface" aria-label="Project dashboard error">
          <h3>Unable to load project dashboard.</h3>
          <p>{state.message}</p>
        </section>
      ) : null}
      <div className="status-grid">
        {renderedStats.map((stat) => (
          <article className="status-tile" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>
      <section className="work-surface" aria-label="Manuscript status">
        <h3>Manuscript</h3>
        <p>{chapterCount > 0 ? `${chapterCount} chapters loaded.` : 'No chapters yet.'}</p>
      </section>
    </section>
  );
}
