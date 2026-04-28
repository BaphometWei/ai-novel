import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/client';
import { App } from '../App';
import { ReviewCenter } from '../components/ReviewCenter';
import { RevisionDiff } from '../components/RevisionDiff';

afterEach(() => {
  cleanup();
});

describe('review center revision diff flow', () => {
  it('shows a revision suggestion as a before and after diff with risk state', () => {
    render(
      <RevisionDiff
        suggestion={{
          title: 'Move secret use after reveal',
          rationale: 'Keeps the knowledge boundary intact.',
          before: 'Mira names the living bell before the reveal.',
          after: 'Mira hears the living bell but cannot name it yet.',
          risk: 'Medium',
          status: 'Proposed'
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Revision Diff' })).toBeInTheDocument();
    expect(screen.getByText('Move secret use after reveal')).toBeInTheDocument();
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('Mira names the living bell before the reveal.')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText('Mira hears the living bell but cannot name it yet.')).toBeInTheDocument();
    expect(screen.getByText('Risk: Medium')).toBeInTheDocument();
    expect(screen.getByText('Revision status: Proposed')).toBeInTheDocument();
  });

  it('keeps finding actions and revision status in sync', () => {
    render(<ReviewCenter />);

    expect(screen.getByText('Revision status: Proposed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Finding status: Applied')).toBeInTheDocument();
    expect(screen.getByText('Revision status: Applied')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText('Finding status: Rejected')).toBeInTheDocument();
    expect(screen.getByText('Revision status: Rejected')).toBeInTheDocument();
  });

  it('loads review findings from the API and records finding actions', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/projects/project_api/review/reports') {
        expect(init).toBeUndefined();
        return jsonResponse([reviewReportFixture('project_api', 'API continuity problem')]);
      }
      if (path === '/api/review/findings/review_finding_api/actions') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({
          projectId: 'project_api',
          action: 'ApplyRevision',
          decidedBy: 'operator'
        });
        return jsonResponse({
          findingId: 'review_finding_api',
          action: 'ApplyRevision',
          previousStatus: 'Open',
          nextStatus: 'Applied',
          decidedBy: 'operator',
          occurredAt: '2026-04-28T09:00:00.000Z'
        });
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    render(<ReviewCenter client={client} projectId="project_api" />);

    expect(await screen.findByText('API continuity problem')).toBeInTheDocument();
    expect(screen.getByText('Quality 81')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith('/api/review/findings/review_finding_api/actions', expect.any(Object));
    });
    expect(await screen.findByText('Finding status: Applied')).toBeInTheDocument();
    expect(screen.getByText('Action ApplyRevision recorded.')).toBeInTheDocument();
  });

  it('shows an API-backed empty state without rendering demo findings when there are no reports', async () => {
    const client = createApiClient({
      baseUrl: '/api',
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        if (String(url) === '/api/projects/project_empty/review/reports') return jsonResponse([]);
        return jsonResponse({ error: 'Not found' }, false, 404);
      })
    });

    render(<ReviewCenter client={client} projectId="project_empty" />);

    expect(await screen.findByText('No review findings yet.')).toBeInTheDocument();
    expect(screen.queryByText('High risk knowledge-boundary issue in chapter 12 draft.')).not.toBeInTheDocument();
    expect(screen.queryByText('Quality 76')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('shows a no-project empty state without calling the review API', () => {
    const fetchImpl = vi.fn();
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    render(<ReviewCenter client={client} />);

    expect(screen.getByText('No project available.')).toBeInTheDocument();
    expect(screen.queryByText('High risk knowledge-boundary issue in chapter 12 draft.')).not.toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('receives the shared App API client after a project is selected', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/projects') return jsonResponse([{ id: 'project_app', title: 'App Project' }]);
      if (path === '/api/projects/project_app') {
        return jsonResponse({ id: 'project_app', title: 'App Project', status: 'Active' });
      }
      if (path === '/api/projects/project_app/chapters') return jsonResponse([]);
      if (path === '/api/projects/project_app/review/reports') {
        expect(init).toBeUndefined();
        return jsonResponse([reviewReportFixture('project_app', 'App wired continuity problem')]);
      }
      return jsonResponse(emptyResponseFor(path));
    });

    render(<App apiBaseUrl="/api" fetchImpl={fetchImpl} />);

    expect(await screen.findByText('App wired continuity problem')).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith('/api/projects/project_app/review/reports');

    const reviewCenter = screen.getByRole('region', { name: 'Review Center' });
    fireEvent.click(within(reviewCenter).getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/review/findings/review_finding_api/actions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ projectId: 'project_app', action: 'ApplyRevision', decidedBy: 'operator' })
        })
      );
    });
  });
});

function reviewReportFixture(projectId: string, problem: string) {
  return {
    id: 'review_report_api',
    projectId,
    manuscriptVersionId: 'manuscript_version_api',
    profile: { id: 'review_profile_api', name: 'Continuity', enabledCategories: ['Continuity'] },
    qualityScore: { overall: 81, continuity: 72, promiseSatisfaction: 88, prose: 79 },
    openFindingCount: 1,
    findings: [
      {
        id: 'review_finding_api',
        manuscriptVersionId: 'manuscript_version_api',
        category: 'Continuity',
        severity: 'High',
        problem,
        evidenceCitations: [{ sourceId: 'chapter_api', quote: 'The door is both locked and open.' }],
        impact: 'Reader loses spatial continuity.',
        fixOptions: ['Keep the door locked until the reveal.'],
        autoFixRisk: 'Medium',
        status: 'Open'
      }
    ]
  };
}

function emptyResponseFor(path: string): unknown {
  if (path.endsWith('/branches/scenarios')) return [];
  if (path.includes('/targets/') && path.endsWith('/retcon-proposals')) return [];
  if (path.includes('/retcon-proposals/') && path.endsWith('/regression-check-runs')) return [];
  if (path.endsWith('/review/reports')) return [];
  if (path === '/api/approvals') return { items: [] };
  if (path === '/api/observability/summary') return observabilitySummaryFixture();
  if (path === '/api/agent-room/runs') return [];
  if (path === '/api/settings/providers/openai') {
    return {
      provider: 'openai',
      defaultModel: 'gpt-default',
      secretRef: 'env:OPENAI_API_KEY',
      redactedMetadata: {},
      updatedAt: '2026-04-27T00:00:00.000Z'
    };
  }
  if (path === '/api/settings/model-routing/defaults') {
    return {
      provider: 'openai',
      draftingModel: 'gpt-draft',
      reviewModel: 'gpt-review',
      updatedAt: '2026-04-27T00:00:00.000Z'
    };
  }
  if (path === '/api/settings/budgets/defaults') {
    return {
      provider: 'openai',
      maxRunCostUsd: 0.5,
      updatedAt: '2026-04-27T00:00:00.000Z'
    };
  }
  if (path === '/api/settings/source-policy/defaults') {
    return {
      allowUserSamples: true,
      allowLicensedSamples: false,
      allowPublicDomain: true,
      restrictedSourceIds: [],
      updatedAt: '2026-04-27T00:00:00.000Z'
    };
  }
  return { ok: true };
}

function observabilitySummaryFixture() {
  return {
    cost: { totalUsd: 0, averageUsdPerRun: 0 },
    latency: { averageDurationMs: 0, p95DurationMs: 0 },
    tokens: { total: 0, averagePerRun: 0 },
    quality: { acceptedRate: 0, openIssueCount: 0, highSeverityOpenCount: 0, outcomes: {} },
    adoption: { adoptedRate: 0, partialRate: 0, rejectedRate: 0, byFeature: {} },
    modelUsage: [],
    runErrors: [],
    workflowBottlenecks: []
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
