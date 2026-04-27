import { describe, expect, it } from 'vitest';
import { buildSerializationRecommendations } from './recommendations';
import type { SerializationPlatformProfile } from './platform-profile';

const profile: SerializationPlatformProfile = {
  id: 'platform_serial_daily',
  name: 'Serial Daily',
  cadence: { type: 'daily', chaptersPerWeek: 7, preferredLocalTimes: ['20:00'] },
  chapterLengthRange: { min: 1800, max: 2600 },
  title: { maxLength: 36, requiresKeyword: true },
  hook: { maxCharacters: 120, mustSurfaceConflict: true },
  recap: { maxCharacters: 240, requiredForReturningReaders: true },
  cliffhanger: { required: true, maxRisk: 'Medium' },
  readerSegment: 'returning_reader',
  riskTolerance: {
    readerPromise: 'Low',
    reveal: 'Low',
    sourcePolicy: 'None',
    updateCalendar: 'Medium'
  }
};

describe('Serialization recommendations', () => {
  it('suggests title hook recap cliffhanger and update calendar with evidence and warnings', () => {
    const recommendations = buildSerializationRecommendations({
      profile,
      chapter: {
        id: 'chapter_12',
        title: 'The Hidden Ledger',
        synopsis: 'Mira confronts the guild auditor while the old promise about her brother comes due.',
        currentWordCount: 3100,
        unresolvedPromiseTitles: ['Brother in the vault'],
        plannedRevealTitles: ['Auditor serves the rival house']
      },
      updateSchedule: {
        timezone: 'Asia/Shanghai',
        slots: [{ weekday: 1, localTime: '20:00' }],
        bufferTargetChapters: 7,
        currentBufferChapters: 2,
        bufferGap: 5
      },
      readerSignals: [
        { tag: 'recap_gap', count: 3, affectedSegments: ['returning_reader'] },
        { tag: 'payoff_wait', count: 2, affectedSegments: ['core_reader'] }
      ]
    });

    expect(recommendations.map((recommendation) => recommendation.kind)).toEqual([
      'title',
      'hook',
      'recap',
      'cliffhanger',
      'update_calendar'
    ]);
    expect(recommendations.every((recommendation) => recommendation.evidence.length > 0)).toBe(true);
    expect(recommendations.find((recommendation) => recommendation.kind === 'recap')?.warnings).toContain(
      'Reader feedback indicates recap gaps.'
    );
    expect(recommendations.find((recommendation) => recommendation.kind === 'update_calendar')?.warnings).toContain(
      'Buffer is 5 chapter(s) below target for daily cadence.'
    );
  });
});
