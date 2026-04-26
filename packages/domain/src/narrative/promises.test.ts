import { describe, expect, it } from 'vitest';
import {
  assessReaderPromiseHealth,
  createReaderPromiseFromDetection,
  getReaderPromiseUiState
} from './promises';

describe('Reader Promise governance', () => {
  it('routes core promises detected from an agent run to the high-risk decision queue', () => {
    const result = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The sealed tower must matter',
      level: 'MainPlot',
      strength: 'Core',
      surfaceClue: 'Every map omits the sealed tower.',
      hiddenQuestion: 'Who sealed the tower and why?',
      readerExpectation: 'The tower hides a main-plot truth.',
      firstAppearance: { chapterId: 'chapter_001', chapterNumber: 1 },
      relatedEntities: [{ type: 'Location', id: 'sealed_tower' }],
      payoffWindow: { startChapter: 20, endChapter: 24 },
      sourceRunId: 'agent_run_abc',
      detectionConfidence: 0.94
    });

    expect(result.promise.strength).toBe('Core');
    expect(result.promise.status).toBe('Candidate');
    expect(result.approvalSignal).toMatchObject({
      targetType: 'ReaderPromise',
      targetId: result.promise.id,
      riskLevel: 'High',
      status: 'Pending'
    });
    expect(result.decisionQueueEntry).toEqual({
      targetType: 'ReaderPromise',
      targetId: result.promise.id,
      reason: 'Core reader promise detected from agent run agent_run_abc',
      riskLevel: 'High'
    });
    expect(getReaderPromiseUiState(result.promise)).toBe('PendingConfirmation');
  });

  it('marks an active promise ready for payoff when chapter, entity, and payoff window match', () => {
    const { promise } = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The heirloom blade chooses an owner',
      level: 'Volume',
      strength: 'High',
      surfaceClue: 'The blade hums near Mei.',
      hiddenQuestion: 'Why does the blade respond to Mei?',
      readerExpectation: 'Mei is connected to the blade lineage.',
      firstAppearance: { chapterId: 'chapter_003', chapterNumber: 3 },
      relatedEntities: [
        { type: 'Character', id: 'mei' },
        { type: 'Object', id: 'heirloom_blade' }
      ],
      payoffWindow: { startChapter: 10, endChapter: 12 },
      sourceRunId: 'agent_run_abc',
      detectionConfidence: 0.91
    });

    const assessment = assessReaderPromiseHealth(
      { ...promise, status: 'Active' },
      {
        currentChapter: 11,
        relatedEntitiesInScene: [{ type: 'Object', id: 'heirloom_blade' }]
      }
    );

    expect(assessment.health).toBe('ReadyForPayoff');
    expect(getReaderPromiseUiState({ ...promise, status: 'Active', health: assessment.health })).toBe(
      'ReadyForPayoff'
    );
  });

  it.each([
    ['Candidate', 'PendingConfirmation'],
    ['Active', 'Active'],
    ['PaidOff', 'Resolved'],
    ['Conflict', 'Problem'],
    ['Dropped', 'Problem'],
    ['Delayed', 'Parked']
  ] as const)('maps %s promises to %s UI state', (status, uiState) => {
    const { promise } = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'A minor oath should echo later',
      level: 'Chapter',
      strength: 'Medium',
      surfaceClue: 'Jun swears he never lies.',
      hiddenQuestion: 'Will Jun keep the oath?',
      readerExpectation: 'The oath will be tested.',
      firstAppearance: { chapterId: 'chapter_002', chapterNumber: 2 },
      relatedEntities: [{ type: 'Character', id: 'jun' }],
      payoffWindow: { startChapter: 4, endChapter: 6 },
      sourceRunId: 'agent_run_abc',
      detectionConfidence: 0.82
    });

    expect(getReaderPromiseUiState({ ...promise, status })).toBe(uiState);
  });
});
