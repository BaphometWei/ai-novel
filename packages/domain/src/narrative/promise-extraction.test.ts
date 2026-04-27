import { describe, expect, it } from 'vitest';
import { extractPromiseCandidatesFromStructuredText } from './promise-extraction';

describe('promise extraction from structured accepted text and scene notes', () => {
  it('routes promise candidates by confidence tier without mutating accepted source text', () => {
    const acceptedText = 'The drowned bell rang once, though no hand touched it.';
    const result = extractPromiseCandidatesFromStructuredText({
      projectId: 'project_abc',
      sourceRunId: 'agent_run_abc',
      acceptedText,
      sceneNotes: {
        chapterId: 'chapter_001',
        chapterNumber: 1,
        promiseSignals: [
          {
            title: 'The drowned bell must be answered',
            surfaceClue: 'The drowned bell rang once, though no hand touched it.',
            hiddenQuestion: 'Who drowned the bell and what does it know?',
            readerExpectation: 'The bell truth should change the ending.',
            relatedEntities: [{ type: 'Object', id: 'drowned_bell' }],
            importance: 'Core',
            payoffWindow: { startChapter: 21, endChapter: 24 },
            confidence: 0.93
          },
          {
            title: 'Jun may break his oath',
            surfaceClue: 'Jun swears he never lies.',
            hiddenQuestion: 'Will Jun keep the oath?',
            readerExpectation: 'The oath should be tested soon.',
            relatedEntities: [{ type: 'Character', id: 'jun' }],
            importance: 'Major',
            payoffWindow: { startChapter: 4, endChapter: 6 },
            confidence: 0.82
          },
          {
            title: 'The bakery sign might matter',
            surfaceClue: 'The bakery sign hangs crooked.',
            hiddenQuestion: 'Does the sign hide a clue?',
            readerExpectation: 'The sign may return as a clue.',
            relatedEntities: [{ type: 'Location', id: 'bakery' }],
            importance: 'Minor',
            payoffWindow: { startChapter: 2, endChapter: 3 },
            confidence: 0.68
          },
          {
            title: 'The tea cup could be a clue',
            surfaceClue: 'A chipped tea cup sits on the sill.',
            hiddenQuestion: 'Who left the cup?',
            readerExpectation: 'The cup could identify a visitor.',
            relatedEntities: [{ type: 'Object', id: 'tea_cup' }],
            importance: 'Minor',
            payoffWindow: { startChapter: 2, endChapter: 4 },
            confidence: 0.41
          }
        ]
      }
    });

    expect(result.candidates.map((candidate) => candidate.confidenceTier)).toEqual([
      'decision_queue',
      'confirmation_list',
      'summary',
      'silent_pool'
    ]);
    expect(result.decisionQueue.map((candidate) => candidate.title)).toEqual(['The drowned bell must be answered']);
    expect(result.confirmationList.map((candidate) => candidate.title)).toEqual(['Jun may break his oath']);
    expect(result.summary.map((candidate) => candidate.title)).toEqual(['The bakery sign might matter']);
    expect(result.silentPool.map((candidate) => candidate.title)).toEqual(['The tea cup could be a clue']);
    expect(acceptedText).toBe('The drowned bell rang once, though no hand touched it.');
  });
});
