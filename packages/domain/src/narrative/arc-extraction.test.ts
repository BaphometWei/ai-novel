import { describe, expect, it } from 'vitest';
import { createRelationshipState } from './arcs';
import { extractArcSignalsFromSceneNotes } from './arc-extraction';

const outlineSource = { type: 'outline', id: 'outline_1' };

describe('arc extraction from scene notes', () => {
  it('extracts motivation and relationship signals without mutating canon state', () => {
    const canonRelationship = createRelationshipState({
      characterId: 'character_hero',
      counterpartId: 'character_rival',
      disposition: 'Hostile',
      source: outlineSource
    });

    const result = extractArcSignalsFromSceneNotes({
      sceneId: 'scene_12',
      source: { type: 'scene_note', id: 'scene_12_notes' },
      canon: {
        relationships: [canonRelationship],
        motivations: []
      },
      notes: {
        motivations: [
          {
            characterId: 'character_hero',
            currentGoal: 'Steal the treaty before sunrise',
            pressure: 'The guards change shifts in ten minutes',
            beliefChallenge: 'Winning without allies may be impossible'
          }
        ],
        relationships: [
          {
            characterId: 'character_hero',
            counterpartId: 'character_rival',
            disposition: 'Loyal',
            reason: 'The rival smiles and says they are friends now'
          }
        ]
      }
    });

    expect(result.extracted.motivations).toEqual([
      {
        characterId: 'character_hero',
        currentGoal: 'Steal the treaty before sunrise',
        pressure: 'The guards change shifts in ten minutes',
        beliefChallenge: 'Winning without allies may be impossible',
        source: { type: 'scene_note', id: 'scene_12_notes' },
        sourceEvidence: [{ type: 'scene_note', id: 'scene_12_notes' }]
      }
    ]);
    expect(result.extracted.relationships).toEqual([
      {
        characterId: 'character_hero',
        counterpartId: 'character_rival',
        disposition: 'Loyal',
        reason: 'The rival smiles and says they are friends now',
        source: { type: 'scene_note', id: 'scene_12_notes' }
      }
    ]);
    expect(result.findings.map((finding) => finding.code)).toEqual(['relationship_unearned_loyalty_leap']);
    expect(result.approvalNeeds).toHaveLength(1);
    expect(canonRelationship.disposition).toBe('Hostile');
    expect(canonRelationship.changeHistory).toEqual([]);
  });

  it('passes through earned relationship turning points from scene notes', () => {
    const canonRelationship = createRelationshipState({
      characterId: 'character_hero',
      counterpartId: 'character_rival',
      disposition: 'Hostile',
      source: outlineSource
    });

    const result = extractArcSignalsFromSceneNotes({
      sceneId: 'scene_13',
      source: { type: 'scene_note', id: 'scene_13_notes' },
      canon: {
        relationships: [canonRelationship],
        motivations: []
      },
      notes: {
        relationships: [
          {
            characterId: 'character_hero',
            counterpartId: 'character_rival',
            disposition: 'Loyal',
            reason: 'The rival saves the hero from the tribunal',
            turningPoint: {
              eventId: 'scene_13_tribunal',
              description: 'The rival destroys their own alibi to protect the hero.'
            }
          }
        ]
      }
    });

    expect(result.findings).toEqual([]);
    expect(result.approvalNeeds).toEqual([]);
    expect(result.extracted.relationships[0].turningPoint).toEqual({
      eventId: 'scene_13_tribunal',
      description: 'The rival destroys their own alibi to protect the hero.',
      source: { type: 'scene_note', id: 'scene_13_notes' }
    });
    expect(canonRelationship.disposition).toBe('Hostile');
  });
});
