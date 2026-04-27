import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApiClient,
  type RecurringIssueSummary,
  type ReviewFinding,
  type ReviewLearningApiClient,
  type RevisionRecheckResult
} from '../api/client';
import { ReviewLearningPanel } from '../components/ReviewLearningPanel';

describe('ReviewLearningPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads and renders recurring issue trend summaries from the injected client', async () => {
    const client = mockReviewLearningClient();
    const summarizeRecurringIssues = vi.spyOn(client, 'summarizeRecurringIssues');

    render(<ReviewLearningPanel client={client} previousFindings={previousFindings} currentFindings={currentFindings} />);

    expect(screen.getByRole('heading', { name: 'Review Learning' })).toBeInTheDocument();
    expect(screen.getByText('Loading review learning...')).toBeInTheDocument();

    expect(await screen.findByText('Continuity:compass changes color')).toBeInTheDocument();
    expect(screen.getByText('3 occurrences')).toBeInTheDocument();
    expect(screen.getByText('Escalating')).toBeInTheDocument();
    expect(screen.getByText('High risk')).toBeInTheDocument();
    expect(screen.getByText('chapter_1, chapter_2, chapter_3')).toBeInTheDocument();
    expect(summarizeRecurringIssues).toHaveBeenCalledWith({ findings: currentFindings, minimumOccurrences: 2 });
  });

  it('runs a revision recheck and renders lifecycle statuses and regression count', async () => {
    const client = mockReviewLearningClient();
    const recheckRevisionReview = vi.spyOn(client, 'recheckRevisionReview');

    render(
      <ReviewLearningPanel
        client={client}
        previousManuscriptVersionId="chapter_1_v1"
        currentManuscriptVersionId="chapter_1_v2"
        previousFindings={previousFindings}
        currentFindings={currentFindings}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Run recheck' }));

    expect(await screen.findByText('review_finding_fixed')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('review_finding_open -> review_finding_current')).toBeInTheDocument();
    expect(screen.getByText('StillOpen')).toBeInTheDocument();
    expect(screen.getByText('Regressions 1')).toBeInTheDocument();
    expect(recheckRevisionReview).toHaveBeenCalledWith({
      checkedAt: expect.any(String),
      previousManuscriptVersionId: 'chapter_1_v1',
      currentManuscriptVersionId: 'chapter_1_v2',
      previousFindings,
      currentFindings
    });
  });

  it('shows load and recheck error states', async () => {
    const client = mockReviewLearningClient({ rejectSummary: true, rejectRecheck: true });

    render(<ReviewLearningPanel client={client} previousFindings={previousFindings} currentFindings={currentFindings} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Recurring issue summary failed');

    fireEvent.click(screen.getByRole('button', { name: 'Run recheck' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Revision recheck failed');
  });
});

describe('review learning API client helpers', () => {
  it('posts recurring issue and revision recheck payloads through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/review-learning/recurring-issues' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ findings: currentFindings, minimumOccurrences: 2 });
        return jsonResponse({ recurringIssues });
      }
      if (path === '/api/review-learning/recheck' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          checkedAt: '2026-04-27T12:00:00.000Z',
          previousManuscriptVersionId: 'chapter_1_v1',
          currentManuscriptVersionId: 'chapter_1_v2',
          previousFindings,
          currentFindings
        });
        return jsonResponse(recheckResult);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.summarizeRecurringIssues({ findings: currentFindings, minimumOccurrences: 2 })).resolves.toEqual({
      recurringIssues
    });
    await expect(
      client.recheckRevisionReview({
        checkedAt: '2026-04-27T12:00:00.000Z',
        previousManuscriptVersionId: 'chapter_1_v1',
        currentManuscriptVersionId: 'chapter_1_v2',
        previousFindings,
        currentFindings
      })
    ).resolves.toEqual(recheckResult);

    expect(fetchImpl).toHaveBeenCalledWith('/api/review-learning/recurring-issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findings: currentFindings, minimumOccurrences: 2 })
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/review-learning/recheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkedAt: '2026-04-27T12:00:00.000Z',
        previousManuscriptVersionId: 'chapter_1_v1',
        currentManuscriptVersionId: 'chapter_1_v2',
        previousFindings,
        currentFindings
      })
    });
  });
});

function mockReviewLearningClient(options: { rejectSummary?: boolean; rejectRecheck?: boolean } = {}): ReviewLearningApiClient {
  return {
    summarizeRecurringIssues: async () => {
      if (options.rejectSummary) throw new Error('Recurring issue summary failed');
      return { recurringIssues };
    },
    recheckRevisionReview: async () => {
      if (options.rejectRecheck) throw new Error('Revision recheck failed');
      return recheckResult;
    }
  };
}

const previousFindings: ReviewFinding[] = [
  finding({ id: 'review_finding_fixed', manuscriptVersionId: 'chapter_1_v1', problem: 'Door opens twice' }),
  finding({ id: 'review_finding_open', manuscriptVersionId: 'chapter_1_v1', problem: 'Motive is unclear' })
];

const currentFindings: ReviewFinding[] = [
  finding({ id: 'review_finding_current', manuscriptVersionId: 'chapter_1_v2', problem: 'Motive is unclear' })
];

const recurringIssues: RecurringIssueSummary[] = [
  {
    signature: 'Continuity:compass changes color',
    category: 'Continuity',
    occurrenceCount: 3,
    chapterIds: ['chapter_1', 'chapter_2', 'chapter_3'],
    findingIds: ['review_finding_1', 'review_finding_2', 'review_finding_3'],
    highestSeverity: 'High',
    trend: 'Escalating',
    risk: 'High'
  }
];

const recheckResult: RevisionRecheckResult = {
  previousManuscriptVersionId: 'chapter_1_v1',
  currentManuscriptVersionId: 'chapter_1_v2',
  statuses: [
    { findingId: 'review_finding_fixed', status: 'Resolved' },
    { findingId: 'review_finding_open', status: 'StillOpen', currentFindingId: 'review_finding_current' }
  ],
  regressions: [
    {
      finding: finding({ id: 'review_finding_regressed', status: 'Regression' }),
      event: {
        id: 'review_learning_1',
        findingId: 'review_finding_regressed',
        kind: 'Regression',
        previousStatus: 'Resolved',
        nextStatus: 'Regression',
        manuscriptVersionId: 'chapter_1_v2',
        detectedByFindingId: 'review_finding_current',
        occurredAt: '2026-04-27T12:00:00.000Z'
      }
    }
  ],
  recurringIssues
};

function finding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    id: 'review_finding_1',
    manuscriptVersionId: 'chapter_1_v1',
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

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
