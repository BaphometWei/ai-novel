import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

function readerPromisePayload() {
  return {
    promise: {
      id: 'reader_promise_1',
      projectId: 'project_1',
      title: 'The locked observatory',
      level: 'Chapter',
      strength: 'Core',
      surfaceClue: 'The observatory is always locked at noon.',
      hiddenQuestion: 'Who is using the observatory?',
      readerExpectation: 'The lock schedule will matter.',
      firstAppearance: { chapterId: 'chapter_1', chapterNumber: 1 },
      relatedEntities: [{ type: 'Location', id: 'observatory' }],
      evidence: [{ chapterId: 'chapter_1', chapterNumber: 1, excerpt: 'The observatory door clicked shut.', signal: 'Question' }],
      payoffWindow: { startChapter: 3, endChapter: 5 },
      sourceRunId: 'agent_run_1',
      detectionConfidence: 0.91,
      status: 'Active',
      health: 'Normal'
    },
    currentChapter: 4,
    relatedEntitiesInScene: [{ type: 'Location', id: 'observatory' }],
    evidence: [{ chapterId: 'chapter_4', chapterNumber: 4, excerpt: 'The observatory key was warm.', signal: 'Payoff' }]
  };
}

describe('narrative intelligence API routes', () => {
  it('builds a project narrative summary from persisted narrative state records', async () => {
    const app = buildApp({
      narrativeIntelligence: {
        narrativeStates: {
          listByProjectAndType: async (projectId, type) =>
            narrativeStateRecords.filter((record) => record.projectId === projectId && record.type === type)
        }
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/narrative-intelligence/projects/project_1/summary?currentChapter=7'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      projectId: 'project_1',
      currentChapter: 7,
      promiseStates: [
        {
          id: 'reader_promise_1',
          title: 'The locked observatory',
          health: 'ReadyForPayoff',
          uiState: 'ReadyForPayoff',
          recommendation: {
            action: 'payoff'
          }
        }
      ],
      closure: {
        projectId: 'project_1',
        blockerCount: 2,
        blockers: [
          {
            id: 'reader_promise_1',
            label: 'Resolve Core promise: The locked observatory'
          },
          {
            id: 'arc_mira_truth',
            label: 'Close major character arc: Mira chooses trust over control'
          }
        ]
      }
    });

    await app.close();
  });

  it('inspects reader promise payoff readiness from supplied evidence', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/narrative-intelligence/reader-promises/inspect',
      payload: readerPromisePayload()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      health: 'ReadyForPayoff',
      uiState: 'ReadyForPayoff',
      recommendation: {
        action: 'payoff',
        reason: 'Promise is in its payoff window with matching entity evidence.'
      }
    });

    await app.close();
  });

  it('builds a closure checklist for unresolved core promises and major arcs', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/narrative-intelligence/closure-checklist/inspect',
      payload: {
        projectId: 'project_1',
        promises: [
          {
            id: 'reader_promise_1',
            importance: 'Core',
            status: 'Active',
            summary: 'Reveal who uses the observatory',
            payoffWindow: { startChapter: 3, endChapter: 5 },
            currentChapter: 6
          },
          {
            id: 'reader_promise_2',
            importance: 'Minor',
            status: 'Active',
            summary: 'Explain the teacup'
          }
        ],
        characterArcs: [
          {
            id: 'arc_1',
            characterId: 'character_1',
            importance: 'Major',
            status: 'Active',
            summary: 'Let Mira choose trust over control',
            currentChapter: 9,
            targetChapter: 10
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: 'project_1',
      items: [
        {
          sourceType: 'ReaderPromise',
          sourceId: 'reader_promise_1',
          severity: 'Blocking',
          risk: 'Overdue',
          status: 'NeedsResolution',
          label: 'Resolve Core promise: Reveal who uses the observatory'
        },
        {
          sourceType: 'CharacterArc',
          sourceId: 'arc_1',
          severity: 'Blocking',
          risk: 'DueSoon',
          status: 'NeedsResolution',
          label: 'Close major character arc: Let Mira choose trust over control'
        }
      ]
    });

    await app.close();
  });

  it('rejects invalid narrative intelligence payloads', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/narrative-intelligence/reader-promises/inspect',
      payload: { promise: { id: '' } }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid narrative intelligence payload' });

    await app.close();
  });
});

const narrativeStateRecords = [
  {
    id: 'reader_promise_1',
    projectId: 'project_1',
    type: 'promise' as const,
    payload: {
      id: 'reader_promise_1',
      projectId: 'project_1',
      title: 'The locked observatory',
      level: 'Chapter',
      strength: 'Core',
      surfaceClue: 'The observatory is always locked at noon.',
      hiddenQuestion: 'Who is using the observatory?',
      readerExpectation: 'The lock schedule will matter.',
      firstAppearance: { chapterId: 'chapter_1', chapterNumber: 1 },
      relatedEntities: [{ type: 'Location', id: 'observatory' }],
      evidence: [{ chapterId: 'chapter_4', chapterNumber: 4, excerpt: 'The observatory key was warm.', signal: 'Payoff' }],
      payoffWindow: { startChapter: 6, endChapter: 8 },
      sourceRunId: 'agent_run_1',
      detectionConfidence: 0.91,
      status: 'Active',
      health: 'Normal'
    }
  },
  {
    id: 'arc_mira_truth',
    projectId: 'project_1',
    type: 'arc' as const,
    payload: {
      id: 'arc_mira_truth',
      characterId: 'character_mira',
      importance: 'Major',
      status: 'Open',
      summary: 'Mira chooses trust over control',
      currentChapter: 7,
      targetChapter: 8
    }
  },
  {
    id: 'reader_promise_other',
    projectId: 'project_other',
    type: 'promise' as const,
    payload: {
      id: 'reader_promise_other',
      projectId: 'project_other',
      title: 'Other project promise'
    }
  }
];
