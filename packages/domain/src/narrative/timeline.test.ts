import { describe, expect, it } from 'vitest';
import { assertCharacterLocationContinuity, createCausalLink } from './timeline';

describe('Timeline, location, and causality', () => {
  it('rejects a causal link when the effect occurs before the cause', () => {
    expect(() =>
      createCausalLink({
        cause: { eventId: 'scene_alarm', occursAt: '2026-04-27T12:00:00.000Z' },
        effect: { eventId: 'scene_escape', occursAt: '2026-04-27T11:55:00.000Z' },
        description: 'The alarm causes the prisoner to escape'
      })
    ).toThrow('Causal link effect cannot occur before its cause');
  });

  it('allows a causal link when the effect follows the cause', () => {
    const link = createCausalLink({
      cause: { eventId: 'scene_alarm', occursAt: '2026-04-27T12:00:00.000Z' },
      effect: { eventId: 'scene_escape', occursAt: '2026-04-27T12:05:00.000Z' },
      description: 'The alarm causes the prisoner to escape'
    });

    expect(link.cause.eventId).toBe('scene_alarm');
    expect(link.effect.eventId).toBe('scene_escape');
  });

  it('blocks a character from appearing in distant locations without enough travel duration', () => {
    expect(() =>
      assertCharacterLocationContinuity(
        [
          {
            eventId: 'scene_market',
            characterIds: ['character_hero'],
            locationId: 'location_market',
            startsAt: '2026-04-27T09:00:00.000Z',
            endsAt: '2026-04-27T09:15:00.000Z'
          },
          {
            eventId: 'scene_mountain',
            characterIds: ['character_hero'],
            locationId: 'location_mountain',
            startsAt: '2026-04-27T10:00:00.000Z'
          }
        ],
        [
          {
            fromLocationId: 'location_market',
            toLocationId: 'location_mountain',
            minimumDurationMinutes: 120
          }
        ]
      )
    ).toThrow('Character character_hero cannot travel from location_market to location_mountain in 45 minutes');
  });

  it('allows a character to change distant locations after enough travel duration', () => {
    expect(() =>
      assertCharacterLocationContinuity(
        [
          {
            eventId: 'scene_market',
            characterIds: ['character_hero'],
            locationId: 'location_market',
            startsAt: '2026-04-27T09:00:00.000Z',
            endsAt: '2026-04-27T09:15:00.000Z'
          },
          {
            eventId: 'scene_mountain',
            characterIds: ['character_hero'],
            locationId: 'location_mountain',
            startsAt: '2026-04-27T11:20:00.000Z'
          }
        ],
        [
          {
            fromLocationId: 'location_market',
            toLocationId: 'location_mountain',
            minimumDurationMinutes: 120
          }
        ]
      )
    ).not.toThrow();
  });
});
