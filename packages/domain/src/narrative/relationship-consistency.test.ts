import { describe, expect, it } from 'vitest';
import { createRelationshipState } from './arcs';
import { validateRelationshipTransition } from './relationship-consistency';

const outlineSource = { type: 'outline', id: 'outline_1' };

describe('relationship consistency', () => {
  it('flags a Hostile to Loyal jump without an earned turning point and requests approval', () => {
    const relationship = createRelationshipState({
      characterId: 'character_hero',
      counterpartId: 'character_rival',
      disposition: 'Hostile',
      source: outlineSource
    });

    const result = validateRelationshipTransition(relationship, {
      toDisposition: 'Loyal',
      reason: 'They suddenly trust each other',
      source: outlineSource
    });

    expect(result.accepted).toBe(false);
    expect(result.findings).toEqual([
      {
        code: 'relationship_unearned_loyalty_leap',
        severity: 'High',
        message: 'Hostile relationships cannot become Loyal without an earned turning point.',
        relationship: {
          characterId: 'character_hero',
          counterpartId: 'character_rival',
          fromDisposition: 'Hostile',
          toDisposition: 'Loyal'
        }
      }
    ]);
    expect(result.approvalNeeds).toEqual([
      {
        targetType: 'RelationshipTransition',
        targetId: 'character_hero:character_rival',
        riskLevel: 'High',
        reason: 'Approve or revise the unearned Hostile to Loyal relationship leap.'
      }
    ]);
  });

  it('accepts a Hostile to Loyal transition when the turning point has source evidence', () => {
    const relationship = createRelationshipState({
      characterId: 'character_hero',
      counterpartId: 'character_rival',
      disposition: 'Hostile',
      source: outlineSource
    });

    const result = validateRelationshipTransition(relationship, {
      toDisposition: 'Loyal',
      reason: 'The rival burns their pardon to save the hero',
      source: outlineSource,
      turningPoint: {
        eventId: 'scene_gate_rescue',
        description: 'The rival risks exile to save the hero.',
        source: outlineSource
      }
    });

    expect(result).toEqual({
      accepted: true,
      findings: [],
      approvalNeeds: []
    });
  });
});
