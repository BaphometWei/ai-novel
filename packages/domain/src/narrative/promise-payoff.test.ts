import { describe, expect, it } from 'vitest';
import { createReaderPromiseFromDetection } from './promises';
import { evaluatePromisePayoffQuality } from './promise-payoff';

describe('promise payoff quality', () => {
  const promise = createReaderPromiseFromDetection({
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
    evidence: [{ chapterId: 'chapter_001', chapterNumber: 1, excerpt: 'The drowned bell rang once.' }],
    payoffWindow: { startChapter: 21, endChapter: 24 },
    sourceRunId: 'agent_run_abc',
    detectionConfidence: 0.91
  }).promise;

  it.each([
    [18, 'The heir hears the bell, but only learns it once belonged to a chapel.', ['early', 'too_small']],
    [28, 'The heir finally hears the drowned bell name the founder who betrayed the city.', ['late']],
    [22, 'The bell is destroyed by a meteor that was never mentioned before.', ['unsupported', 'conflicting']],
    [22, 'The bell reveals the founder, the lost gods, every murder, and rewrites the entire succession.', ['too_large']]
  ] as const)('classifies %s payoff quality issues with evidence', (chapterNumber, payoffText, codes) => {
    const result = evaluatePromisePayoffQuality(promise, {
      chapterId: `chapter_${chapterNumber}`,
      chapterNumber,
      payoffText,
      supportingEvidence: [
        {
          chapterId: 'chapter_001',
          chapterNumber: 1,
          excerpt: 'The drowned bell rang once.',
          signal: 'Foreshadowing'
        }
      ]
    });

    expect(result.findings.map((finding) => finding.code)).toEqual(codes);
    expect(result.findings.every((finding) => finding.evidence.length > 0)).toBe(true);
    expect(result.falsePositiveTolerance).toBe('allow_author_override');
  });

  it('accepts a supported in-window payoff that directly answers the reader expectation', () => {
    const result = evaluatePromisePayoffQuality(promise, {
      chapterId: 'chapter_022',
      chapterNumber: 22,
      payoffText: 'The heir hears the drowned bell name the founder who betrayed the city.',
      supportingEvidence: [
        {
          chapterId: 'chapter_001',
          chapterNumber: 1,
          excerpt: 'The drowned bell rang once.',
          signal: 'Foreshadowing'
        },
        {
          chapterId: 'chapter_022',
          chapterNumber: 22,
          excerpt: 'The bell names the founder before the heir.',
          signal: 'Payoff'
        }
      ]
    });

    expect(result.findings).toEqual([]);
    expect(result.classification).toBe('satisfying');
  });
});
