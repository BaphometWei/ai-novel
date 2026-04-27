import type { NarrativeSource, RelationshipDisposition, RelationshipState, RelationshipTurningPoint } from './arcs';

export interface RelationshipTransitionValidationInput {
  toDisposition: RelationshipDisposition;
  reason: string;
  source: NarrativeSource;
  turningPoint?: RelationshipTurningPoint;
}

export interface RelationshipConsistencyFinding {
  code: 'relationship_unearned_loyalty_leap';
  severity: 'High';
  message: string;
  relationship: {
    characterId: string;
    counterpartId: string;
    fromDisposition: RelationshipDisposition;
    toDisposition: RelationshipDisposition;
  };
}

export interface RelationshipApprovalNeed {
  targetType: 'RelationshipTransition';
  targetId: string;
  riskLevel: 'High';
  reason: string;
}

export interface RelationshipTransitionValidationResult {
  accepted: boolean;
  findings: RelationshipConsistencyFinding[];
  approvalNeeds: RelationshipApprovalNeed[];
}

export function validateRelationshipTransition(
  relationship: RelationshipState,
  input: RelationshipTransitionValidationInput
): RelationshipTransitionValidationResult {
  const isUnearnedLoyaltyLeap =
    relationship.disposition === 'Hostile' && input.toDisposition === 'Loyal' && !input.turningPoint;

  if (!isUnearnedLoyaltyLeap) {
    return { accepted: true, findings: [], approvalNeeds: [] };
  }

  return {
    accepted: false,
    findings: [
      {
        code: 'relationship_unearned_loyalty_leap',
        severity: 'High',
        message: 'Hostile relationships cannot become Loyal without an earned turning point.',
        relationship: {
          characterId: relationship.characterId,
          counterpartId: relationship.counterpartId,
          fromDisposition: relationship.disposition,
          toDisposition: input.toDisposition
        }
      }
    ],
    approvalNeeds: [
      {
        targetType: 'RelationshipTransition',
        targetId: `${relationship.characterId}:${relationship.counterpartId}`,
        riskLevel: 'High',
        reason: 'Approve or revise the unearned Hostile to Loyal relationship leap.'
      }
    ]
  };
}
