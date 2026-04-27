import { describe, expect, it } from 'vitest';
import {
  applyReaderPromiseAction,
  assessReaderPromiseHealth,
  createReaderPromiseFromDetection,
  getReaderPromiseUiState,
  recommendReaderPromisePayoff
} from './promises';

describe('Reader Promise governance', () => {
  it('tracks V3 promise evidence, related entities, payoff window, and high-confidence decision routing', () => {
    const result = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The drowned bell must be answered',
      level: 'Endgame',
      strength: 'Core',
      surfaceClue: 'The drowned bell rings whenever the heir lies.',
      hiddenQuestion: 'Who drowned the bell and what does it know?',
      readerExpectation: 'The bell truth should change the ending.',
      firstAppearance: { chapterId: 'chapter_001', chapterNumber: 1 },
      relatedEntities: [
        { type: 'Object', id: 'drowned_bell' },
        { type: 'Character', id: 'heir' }
      ],
      evidence: [
        {
          chapterId: 'chapter_001',
          chapterNumber: 1,
          excerpt: 'The drowned bell rang once, though no hand touched it.',
          signal: 'Foreshadowing'
        }
      ],
      payoffWindow: { startChapter: 21, endChapter: 24 },
      sourceRunId: 'agent_run_abc',
      detectionConfidence: 0.91
    });

    expect(result.promise).toMatchObject({
      strength: 'Core',
      status: 'Candidate',
      relatedEntities: [
        { type: 'Object', id: 'drowned_bell' },
        { type: 'Character', id: 'heir' }
      ],
      evidence: [
        expect.objectContaining({
          chapterNumber: 1,
          signal: 'Foreshadowing'
        })
      ],
      payoffWindow: { startChapter: 21, endChapter: 24 }
    });
    expect(result.decisionQueueEntry).toMatchObject({
      targetType: 'ReaderPromise',
      targetId: result.promise.id,
      riskLevel: 'High'
    });
  });

  it('does not route low-confidence Core candidates until the evidence is strong enough', () => {
    const result = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The garden statue might matter',
      level: 'MainPlot',
      strength: 'Core',
      surfaceClue: 'A statue appears in a dream.',
      hiddenQuestion: 'Is the statue alive?',
      readerExpectation: 'The statue may become plot-relevant.',
      firstAppearance: { chapterId: 'chapter_002', chapterNumber: 2 },
      relatedEntities: [{ type: 'Object', id: 'garden_statue' }],
      payoffWindow: { startChapter: 12, endChapter: 16 },
      sourceRunId: 'agent_run_low',
      detectionConfidence: 0.62
    });

    expect(result.promise.status).toBe('Candidate');
    expect(result.approvalSignal).toBeUndefined();
    expect(result.decisionQueueEntry).toBeUndefined();
  });

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
    ['PayingOff', 'ReadyForPayoff'],
    ['Fulfilled', 'Resolved'],
    ['Abandoned', 'Problem'],
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

  it.each([
    [8, [{ type: 'Character', id: 'mei' }], 'reinforce'],
    [11, [{ type: 'Character', id: 'mei' }], 'payoff'],
    [11, [{ type: 'Location', id: 'archive' }], 'transform'],
    [13, [{ type: 'Character', id: 'mei' }], 'delay'],
    [18, [], 'abandon']
  ] as const)(
    'recommends %s action from chapter and entity evidence',
    (currentChapter, relatedEntitiesInScene, action) => {
      const { promise } = createReaderPromiseFromDetection({
        projectId: 'project_abc',
        title: 'Mei must answer the blade lineage',
        level: 'Volume',
        strength: 'Major',
        surfaceClue: 'The blade hums near Mei.',
        hiddenQuestion: 'Why does the blade respond to Mei?',
        readerExpectation: 'Mei is connected to the blade lineage.',
        firstAppearance: { chapterId: 'chapter_003', chapterNumber: 3 },
        relatedEntities: [{ type: 'Character', id: 'mei' }],
        payoffWindow: { startChapter: 10, endChapter: 12 },
        sourceRunId: 'agent_run_abc',
        detectionConfidence: 0.88
      });

      expect(
        recommendReaderPromisePayoff(
          { ...promise, status: 'Active' },
          {
            currentChapter,
            relatedEntitiesInScene,
            evidence: relatedEntitiesInScene.length
              ? [{ chapterId: 'chapter_current', chapterNumber: currentChapter, excerpt: 'The blade hums again.' }]
              : []
          }
        ).action
      ).toBe(action);
    }
  );

  it.each([
    ['confirm', 'MainPlot', 'Active', 'MainPlot'],
    ['not-a-promise', 'MainPlot', 'Dropped', 'MainPlot'],
    ['raise-importance', 'MainPlot', 'Candidate', 'Endgame'],
    ['lower-importance', 'Volume', 'Candidate', 'Chapter'],
    ['long-range', 'MainPlot', 'Delayed', 'Endgame'],
    ['pay-off-now', 'MainPlot', 'PayingOff', 'MainPlot'],
    ['remind-later', 'MainPlot', 'Delayed', 'MainPlot'],
    ['park', 'MainPlot', 'Delayed', 'MainPlot'],
    ['abandon', 'MainPlot', 'Abandoned', 'MainPlot']
  ] as const)('applies %s user action to promise workflow state', (action, initialLevel, status, level) => {
    const { promise } = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The drowned bell must be answered',
      level: initialLevel,
      strength: 'Core',
      surfaceClue: 'The drowned bell rings whenever the heir lies.',
      hiddenQuestion: 'Who drowned the bell and what does it know?',
      readerExpectation: 'The bell truth should change the ending.',
      firstAppearance: { chapterId: 'chapter_001', chapterNumber: 1 },
      relatedEntities: [{ type: 'Object', id: 'drowned_bell' }],
      payoffWindow: { startChapter: 21, endChapter: 24 },
      sourceRunId: 'agent_run_abc',
      detectionConfidence: 0.91
    });

    const updated = applyReaderPromiseAction(promise, { action });

    expect(updated.status).toBe(status);
    expect(updated.level).toBe(level);
  });

  it('merges promise evidence and keeps the stronger routing fields', () => {
    const base = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The drowned bell must be answered',
      level: 'Volume',
      strength: 'Major',
      surfaceClue: 'The drowned bell rings.',
      hiddenQuestion: 'What does the bell know?',
      readerExpectation: 'The bell truth should matter.',
      firstAppearance: { chapterId: 'chapter_001', chapterNumber: 1 },
      relatedEntities: [{ type: 'Object', id: 'drowned_bell' }],
      evidence: [{ chapterId: 'chapter_001', chapterNumber: 1, excerpt: 'The bell rang once.' }],
      payoffWindow: { startChapter: 10, endChapter: 12 },
      sourceRunId: 'agent_run_abc',
      detectionConfidence: 0.78
    }).promise;
    const duplicate = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The bell names the drowned founder',
      level: 'Endgame',
      strength: 'Core',
      surfaceClue: 'The bell whispers the founder name.',
      hiddenQuestion: 'Which founder drowned it?',
      readerExpectation: 'The founder truth should change the ending.',
      firstAppearance: { chapterId: 'chapter_003', chapterNumber: 3 },
      relatedEntities: [{ type: 'Character', id: 'founder' }],
      evidence: [{ chapterId: 'chapter_003', chapterNumber: 3, excerpt: 'A voice inside the bell said Founder.' }],
      payoffWindow: { startChapter: 20, endChapter: 24 },
      sourceRunId: 'agent_run_def',
      detectionConfidence: 0.93
    }).promise;

    const merged = applyReaderPromiseAction(base, { action: 'merge', duplicate });

    expect(merged).toMatchObject({
      title: 'The bell names the drowned founder',
      level: 'Endgame',
      strength: 'Core',
      detectionConfidence: 0.93,
      payoffWindow: { startChapter: 10, endChapter: 24 }
    });
    expect(merged.relatedEntities).toEqual([
      { type: 'Object', id: 'drowned_bell' },
      { type: 'Character', id: 'founder' }
    ]);
    expect(merged.evidence).toHaveLength(2);
  });
});
