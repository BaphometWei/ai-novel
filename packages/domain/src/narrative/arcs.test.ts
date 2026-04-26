import { describe, expect, it } from 'vitest';
import { createMotivationState, createRelationshipState, transitionRelationshipState } from './arcs';

const outlineSource = { type: 'outline', id: 'outline_1' };

describe('Character arcs and relationships', () => {
  it('blocks a Hostile relationship from becoming Loyal without a turning point', () => {
    const relationship = createRelationshipState({
      characterId: 'character_hero',
      counterpartId: 'character_rival',
      disposition: 'Hostile',
      source: outlineSource
    });

    expect(() =>
      transitionRelationshipState(relationship, 'Loyal', {
        reason: 'They suddenly trust each other',
        source: outlineSource
      })
    ).toThrow('Hostile relationships require a turning point before becoming Loyal');
  });

  it('allows a Hostile relationship to become Loyal with an explicit turning point', () => {
    const relationship = createRelationshipState({
      characterId: 'character_hero',
      counterpartId: 'character_rival',
      disposition: 'Hostile',
      source: outlineSource
    });

    const updated = transitionRelationshipState(relationship, 'Loyal', {
      reason: 'The rival saves the hero at the gate',
      source: outlineSource,
      turningPoint: {
        eventId: 'scene_gate_rescue',
        description: 'The rival risks exile to save the hero.',
        source: outlineSource
      }
    });

    expect(updated.disposition).toBe('Loyal');
    expect(updated.turningPoints).toEqual([
      {
        eventId: 'scene_gate_rescue',
        description: 'The rival risks exile to save the hero.',
        source: outlineSource
      }
    ]);
  });

  it('records motivation goal, pressure, belief challenge, and source', () => {
    const motivation = createMotivationState({
      characterId: 'character_hero',
      currentGoal: 'Expose the false heir before coronation',
      pressure: 'The coronation begins at dawn',
      beliefChallenge: 'Power can be confronted without becoming cruel',
      source: outlineSource
    });

    expect(motivation.currentGoal).toBe('Expose the false heir before coronation');
    expect(motivation.pressure).toBe('The coronation begins at dawn');
    expect(motivation.beliefChallenge).toBe('Power can be confronted without becoming cruel');
    expect(motivation.source).toEqual(outlineSource);
  });
});
