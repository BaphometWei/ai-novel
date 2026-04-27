import { describe, expect, it } from 'vitest';
import { validateLocationConsistency } from './location-consistency';

describe('location consistency validation', () => {
  it('reports impossible travel and missing travel-duration rules with distance evidence', () => {
    const result = validateLocationConsistency({
      appearances: [
        {
          eventId: 'scene_market',
          characterIds: ['character_mai'],
          locationId: 'location_market',
          startsAt: '2026-04-27T09:00:00.000Z',
          endsAt: '2026-04-27T09:10:00.000Z'
        },
        {
          eventId: 'scene_tower',
          characterIds: ['character_mai'],
          locationId: 'location_tower',
          startsAt: '2026-04-27T09:40:00.000Z'
        },
        {
          eventId: 'scene_moon_gate',
          characterIds: ['character_mai'],
          locationId: 'location_moon_gate',
          startsAt: '2026-04-27T10:10:00.000Z'
        }
      ],
      travelDurations: [
        {
          fromLocationId: 'location_market',
          toLocationId: 'location_tower',
          minimumDurationMinutes: 90
        }
      ],
      distances: [
        {
          fromLocationId: 'location_market',
          toLocationId: 'location_tower',
          distanceKm: 60
        },
        {
          fromLocationId: 'location_tower',
          toLocationId: 'location_moon_gate',
          distanceKm: 12
        }
      ]
    });

    expect(result.accepted).toBe(false);
    expect(result.violations).toEqual([
      {
        type: 'impossible_travel',
        severity: 'Blocking',
        characterId: 'character_mai',
        eventIds: ['scene_market', 'scene_tower'],
        locationIds: ['location_market', 'location_tower'],
        evidence: 'character_mai has 30 minutes to travel from location_market to location_tower, but the minimum is 90 minutes over 60 km.',
        confidence: 1,
        falsePositiveTolerance: 'Low'
      },
      {
        type: 'missing_travel_duration_rule',
        severity: 'Medium',
        characterId: 'character_mai',
        eventIds: ['scene_tower', 'scene_moon_gate'],
        locationIds: ['location_tower', 'location_moon_gate'],
        evidence: 'No travel-duration rule exists for location_tower to location_moon_gate; known distance is 12 km.',
        confidence: 0.75,
        falsePositiveTolerance: 'Medium'
      }
    ]);
  });
});
