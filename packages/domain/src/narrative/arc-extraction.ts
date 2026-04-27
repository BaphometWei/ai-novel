import {
  createMotivationState,
  type MotivationState,
  type NarrativeSource,
  type RelationshipDisposition,
  type RelationshipState,
  type RelationshipTurningPoint
} from './arcs';
import {
  validateRelationshipTransition,
  type RelationshipApprovalNeed,
  type RelationshipConsistencyFinding
} from './relationship-consistency';

export interface SceneMotivationNote {
  characterId: string;
  currentGoal: string;
  pressure: string;
  beliefChallenge: string;
}

export interface SceneRelationshipNote {
  characterId: string;
  counterpartId: string;
  disposition: RelationshipDisposition;
  reason: string;
  turningPoint?: Omit<RelationshipTurningPoint, 'source'> & { source?: NarrativeSource };
}

export interface SceneArcNotes {
  motivations?: SceneMotivationNote[];
  relationships?: SceneRelationshipNote[];
}

export interface ExtractedRelationshipSignal {
  characterId: string;
  counterpartId: string;
  disposition: RelationshipDisposition;
  reason: string;
  source: NarrativeSource;
  turningPoint?: RelationshipTurningPoint;
}

export interface ArcExtractionResult {
  extracted: {
    motivations: MotivationState[];
    relationships: ExtractedRelationshipSignal[];
  };
  findings: RelationshipConsistencyFinding[];
  approvalNeeds: RelationshipApprovalNeed[];
}

export function extractArcSignalsFromSceneNotes(input: {
  sceneId: string;
  source: NarrativeSource;
  canon: {
    relationships: RelationshipState[];
    motivations: MotivationState[];
  };
  notes: SceneArcNotes;
}): ArcExtractionResult {
  const motivations = (input.notes.motivations ?? []).map((note) =>
    createMotivationState({
      ...note,
      source: input.source,
      sourceEvidence: [input.source]
    })
  );

  const relationships = (input.notes.relationships ?? []).map((note) => ({
    characterId: note.characterId,
    counterpartId: note.counterpartId,
    disposition: note.disposition,
    reason: note.reason,
    source: input.source,
    ...(note.turningPoint
      ? {
          turningPoint: {
            eventId: note.turningPoint.eventId,
            description: note.turningPoint.description,
            source: note.turningPoint.source ?? input.source
          }
        }
      : {})
  }));

  const consistencyResults = relationships.flatMap((signal) => {
    const canonRelationship = input.canon.relationships.find(
      (relationship) =>
        relationship.characterId === signal.characterId && relationship.counterpartId === signal.counterpartId
    );

    if (!canonRelationship) return [];

    return [
      validateRelationshipTransition(canonRelationship, {
        toDisposition: signal.disposition,
        reason: signal.reason,
        source: signal.source,
        turningPoint: signal.turningPoint
      })
    ];
  });

  return {
    extracted: {
      motivations,
      relationships
    },
    findings: consistencyResults.flatMap((result) => result.findings),
    approvalNeeds: consistencyResults.flatMap((result) => result.approvalNeeds)
  };
}
