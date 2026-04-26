export type RelationshipDisposition = 'Hostile' | 'Neutral' | 'Trusted' | 'Loyal';

export interface NarrativeSource {
  type: string;
  id: string;
}

export interface RelationshipTurningPoint {
  eventId: string;
  description: string;
  source: NarrativeSource;
}

export interface RelationshipState {
  characterId: string;
  counterpartId: string;
  disposition: RelationshipDisposition;
  source: NarrativeSource;
  turningPoints: RelationshipTurningPoint[];
  changeHistory: RelationshipChange[];
}

export interface RelationshipChange {
  fromDisposition: RelationshipDisposition;
  toDisposition: RelationshipDisposition;
  reason: string;
  source: NarrativeSource;
  turningPoint?: RelationshipTurningPoint;
}

export function createRelationshipState(input: {
  characterId: string;
  counterpartId: string;
  disposition: RelationshipDisposition;
  source: NarrativeSource;
}): RelationshipState {
  return {
    ...input,
    turningPoints: [],
    changeHistory: []
  };
}

export function transitionRelationshipState(
  relationship: RelationshipState,
  disposition: RelationshipDisposition,
  input: {
    reason: string;
    source: NarrativeSource;
    turningPoint?: RelationshipTurningPoint;
  }
): RelationshipState {
  if (relationship.disposition === 'Hostile' && disposition === 'Loyal' && !input.turningPoint) {
    throw new Error('Hostile relationships require a turning point before becoming Loyal');
  }

  const change: RelationshipChange = {
    fromDisposition: relationship.disposition,
    toDisposition: disposition,
    reason: input.reason,
    source: input.source,
    ...(input.turningPoint ? { turningPoint: input.turningPoint } : {})
  };

  return {
    ...relationship,
    disposition,
    source: input.source,
    turningPoints: input.turningPoint
      ? [...relationship.turningPoints, input.turningPoint]
      : relationship.turningPoints,
    changeHistory: [...relationship.changeHistory, change]
  };
}

export interface MotivationState {
  characterId: string;
  currentGoal: string;
  pressure: string;
  beliefChallenge: string;
  source: NarrativeSource;
}

export function createMotivationState(input: {
  characterId: string;
  currentGoal: string;
  pressure: string;
  beliefChallenge: string;
  source: NarrativeSource;
}): MotivationState {
  return input;
}
