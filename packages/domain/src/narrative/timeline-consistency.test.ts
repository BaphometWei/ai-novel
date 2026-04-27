import { describe, expect, it } from 'vitest';
import { validateTimelineConsistency } from './timeline-consistency';

describe('timeline consistency validation', () => {
  it('reports missed deadlines, overlapping character conflicts, and downstream causality order errors deterministically', () => {
    const result = validateTimelineConsistency({
      events: [
        {
          id: 'event_oath',
          title: 'Oath sworn',
          startsAt: '2026-04-27T09:00:00.000Z',
          endsAt: '2026-04-27T09:30:00.000Z',
          characterIds: ['character_mai']
        },
        {
          id: 'event_council',
          title: 'Council vote',
          startsAt: '2026-04-27T09:15:00.000Z',
          endsAt: '2026-04-27T10:00:00.000Z',
          characterIds: ['character_mai']
        },
        {
          id: 'event_rescue',
          title: 'Rescue attempt',
          startsAt: '2026-04-27T10:30:00.000Z',
          characterIds: ['character_mai']
        }
      ],
      deadlines: [
        {
          id: 'deadline_gate',
          eventId: 'event_rescue',
          dueAt: '2026-04-27T10:00:00.000Z',
          description: 'The rescue must happen before the gate closes.'
        }
      ],
      causalLinks: [
        {
          causeEventId: 'event_rescue',
          effectEventId: 'event_oath',
          description: 'The rescue convinces Mai to swear the oath.'
        }
      ]
    });

    expect(result.accepted).toBe(false);
    expect(result.violations).toEqual([
      {
        type: 'concurrent_event_conflict',
        severity: 'High',
        eventIds: ['event_oath', 'event_council'],
        evidence: 'character_mai appears in event_oath and event_council during overlapping time windows.',
        confidence: 0.98,
        falsePositiveTolerance: 'Low'
      },
      {
        type: 'causality_order_error',
        severity: 'Blocking',
        eventIds: ['event_rescue', 'event_oath'],
        evidence: 'event_rescue is listed as causing event_oath, but starts after it.',
        confidence: 1,
        falsePositiveTolerance: 'Low'
      },
      {
        type: 'missed_deadline',
        severity: 'High',
        eventIds: ['event_rescue'],
        evidence: 'event_rescue starts at 2026-04-27T10:30:00.000Z after deadline deadline_gate at 2026-04-27T10:00:00.000Z.',
        confidence: 1,
        falsePositiveTolerance: 'Low'
      }
    ]);
  });
});
