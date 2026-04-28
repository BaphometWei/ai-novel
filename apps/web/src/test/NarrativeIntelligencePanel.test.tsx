import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type NarrativeIntelligenceApiClient } from '../api/client';
import { NarrativeIntelligencePanel } from '../components/NarrativeIntelligencePanel';

describe('NarrativeIntelligencePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows project-backed reader promise readiness and closure blockers from the injected client', async () => {
    const client = mockNarrativeClient();

    render(<NarrativeIntelligencePanel client={client} projectId="project_1" currentChapter={7} />);

    expect(screen.getByRole('heading', { name: 'Narrative Intelligence' })).toBeInTheDocument();
    expect(screen.getByText('Loading narrative intelligence...')).toBeInTheDocument();

    const promise = await screen.findByLabelText('Reader promise readiness');
    expect(within(promise).getByText('ReadyForPayoff')).toBeInTheDocument();
    expect(within(promise).getByText('Pay off in this scene')).toBeInTheDocument();
    expect(within(promise).getByText('Promise can land now')).toBeInTheDocument();

    const closure = screen.getByLabelText('Closure blockers');
    expect(within(closure).getByText('2 blockers')).toBeInTheDocument();
    expect(within(closure).getByText('Resolve Core promise: The locked door')).toBeInTheDocument();
    expect(within(closure).getByText('Close major character arc: Mira arc')).toBeInTheDocument();
    expect(client.getNarrativeIntelligenceSummary).toHaveBeenCalledWith('project_1', { currentChapter: 7 });
    expect(client.inspectReaderPromise).not.toHaveBeenCalled();
    expect(client.inspectClosureChecklist).not.toHaveBeenCalled();
  });

  it('shows load errors', async () => {
    render(<NarrativeIntelligencePanel client={mockNarrativeClient({ reject: true })} projectId="project_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Narrative inspect failed');
  });

  it('shows explicit empty states for project-backed narrative data', async () => {
    render(<NarrativeIntelligencePanel client={mockNarrativeClient({ empty: true })} projectId="project_1" />);

    const promise = await screen.findByLabelText('Reader promise readiness');
    expect(within(promise).getByText('No reader promise data yet.')).toBeInTheDocument();

    const closure = screen.getByLabelText('Closure blockers');
    expect(within(closure).getByText('No closure data yet.')).toBeInTheDocument();
  });

  it('shows an empty state without calling the API when no project is selected', async () => {
    const client = mockNarrativeClient();

    render(<NarrativeIntelligencePanel client={client} />);

    expect(screen.getByText('No project available.')).toBeInTheDocument();
    expect(client.getNarrativeIntelligenceSummary).not.toHaveBeenCalled();
  });
});

describe('narrative intelligence API client helpers', () => {
  it('loads project-backed narrative intelligence summaries through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/api/narrative-intelligence/projects/project_1/summary?currentChapter=7');
      expect(init).toBeUndefined();
      return jsonResponse(narrativeSummaryResult);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.getNarrativeIntelligenceSummary('project_1', { currentChapter: 7 })).resolves.toEqual(
      narrativeSummaryResult
    );
  });

  it('posts reader promise and closure inspect payloads through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/narrative-intelligence/reader-promises/inspect') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual(readerPromiseInput);
        return jsonResponse(readerPromiseResult);
      }
      if (path === '/api/narrative-intelligence/closure-checklist/inspect') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual(closureInput);
        return jsonResponse(closureResult);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.inspectReaderPromise(readerPromiseInput)).resolves.toEqual(readerPromiseResult);
    await expect(client.inspectClosureChecklist(closureInput)).resolves.toEqual(closureResult);
  });
});

function mockNarrativeClient(options: { reject?: boolean; empty?: boolean } = {}): NarrativeIntelligenceApiClient {
  return {
    getNarrativeIntelligenceSummary: vi.fn(async () => {
      if (options.reject) throw new Error('Narrative inspect failed');
      if (options.empty) {
        return {
          projectId: 'project_1',
          currentChapter: 7,
          promiseStates: [],
          closure: { projectId: 'project_1', readyCount: 0, blockerCount: 0, blockers: [] }
        };
      }
      return narrativeSummaryResult;
    }),
    inspectReaderPromise: vi.fn(async () => {
      if (options.reject) throw new Error('Narrative inspect failed');
      return readerPromiseResult;
    }),
    inspectClosureChecklist: vi.fn(async () => {
      if (options.reject) throw new Error('Narrative inspect failed');
      return closureResult;
    })
  };
}

const readerPromiseInput = {
  promise: {
    id: 'promise_locked_door',
    projectId: 'project_demo',
    title: 'The locked door',
    level: 'MainPlot',
    strength: 'Core',
    surfaceClue: 'A sealed iron door hums under the archive.',
    hiddenQuestion: 'What is behind the archive door?',
    readerExpectation: 'The door will matter before the midpoint.',
    firstAppearance: { chapterId: 'chapter_1', chapterNumber: 1 },
    relatedEntities: [{ type: 'location', id: 'archive' }],
    evidence: [{ chapterId: 'chapter_6', chapterNumber: 6, excerpt: 'The lock warmed under Mira hand.', signal: 'Payoff' }],
    payoffWindow: { startChapter: 6, endChapter: 8 },
    sourceRunId: 'run_1',
    detectionConfidence: 0.91,
    status: 'Active',
    health: 'Normal'
  },
  currentChapter: 7,
  relatedEntitiesInScene: [{ type: 'location', id: 'archive' }]
};

const readerPromiseResult = {
  promise: { ...readerPromiseInput.promise, health: 'ReadyForPayoff' },
  health: 'ReadyForPayoff',
  uiState: 'ReadyForPayoff',
  recommendation: { action: 'PayoffNow', label: 'Pay off in this scene', reason: 'All related entities are present.' }
};

const closureInput = {
  projectId: 'project_demo',
  promises: [
    {
      id: 'promise_locked_door',
      importance: 'Core',
      status: 'Open',
      summary: 'The locked door',
      payoffWindow: { startChapter: 6, endChapter: 8 },
      currentChapter: 7
    }
  ],
  characterArcs: [
    {
      id: 'arc_mira_truth',
      characterId: 'character_mira',
      importance: 'Major',
      status: 'Open',
      summary: 'Mira arc',
      currentChapter: 7,
      targetChapter: 8
    }
  ]
};

const closureResult = {
  projectId: 'project_demo',
  readyCount: 0,
  blockerCount: 2,
  blockers: [
    { id: 'promise_locked_door', type: 'promise', label: 'The locked door', reason: 'Core promise remains open.' },
    { id: 'arc_mira_truth', type: 'characterArc', label: 'Mira arc', reason: 'Major arc remains open.' }
  ]
};

const narrativeSummaryResult = {
  projectId: 'project_1',
  currentChapter: 7,
  promiseStates: [
    {
      id: 'promise_locked_door',
      title: 'The locked door',
      health: 'ReadyForPayoff',
      uiState: { statusLabel: 'ReadyForPayoff', tone: 'success', summary: 'Promise can land now' },
      recommendation: { action: 'PayoffNow', label: 'Pay off in this scene', reason: 'All related entities are present.' }
    }
  ],
  closure: {
    projectId: 'project_1',
    readyCount: 0,
    blockerCount: 2,
    blockers: [
      {
        id: 'promise_locked_door',
        type: 'ReaderPromise',
        label: 'Resolve Core promise: The locked door',
        reason: 'Overdue'
      },
      {
        id: 'arc_mira_truth',
        type: 'CharacterArc',
        label: 'Close major character arc: Mira arc',
        reason: 'DueSoon'
      }
    ]
  }
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
