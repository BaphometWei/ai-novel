import { describe, expect, it } from 'vitest';
import { createPlatformProfile } from './platform-profile';

describe('Platform profile', () => {
  it('expresses cadence, presentation constraints, reader segment, and risk tolerances', () => {
    const profile = createPlatformProfile({
      id: 'platform_serial_daily',
      name: 'Serial Daily',
      cadence: { type: 'daily', chaptersPerWeek: 7, preferredLocalTimes: ['20:00'] },
      chapterLengthRange: { min: 1800, max: 2600 },
      title: { maxLength: 42, requiresKeyword: true },
      hook: { maxCharacters: 160, mustSurfaceConflict: true },
      recap: { maxCharacters: 320, requiredForReturningReaders: true },
      cliffhanger: { required: true, maxRisk: 'Medium' },
      readerSegment: 'returning_reader',
      riskTolerance: {
        readerPromise: 'Low',
        reveal: 'Low',
        sourcePolicy: 'None',
        updateCalendar: 'Medium'
      }
    });

    expect(profile.cadence.type).toBe('daily');
    expect(profile.title.requiresKeyword).toBe(true);
    expect(profile.hook.mustSurfaceConflict).toBe(true);
    expect(profile.recap.requiredForReturningReaders).toBe(true);
    expect(profile.cliffhanger.maxRisk).toBe('Medium');
    expect(profile.readerSegment).toBe('returning_reader');
    expect(profile.riskTolerance.sourcePolicy).toBe('None');
  });
});
