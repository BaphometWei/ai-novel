import { assessReaderPromiseHealth, getReaderPromiseUiState, type ReaderPromise } from './promises';
import { applyRevealEvent, type KnowledgeState, type RevealEvent, type Secret } from './secrets';
import { createClosureChecklist } from './closure';
import { createRuleException, validatePowerUse, type PowerSystemRule } from './rules';
import { createCausalLink, assertCharacterLocationContinuity, type CausalLink, type CharacterLocationAppearance, type TravelDuration } from './timeline';
import { transitionRelationshipState, type RelationshipState, type RelationshipTurningPoint } from './arcs';

export interface NarrativeHealthReportInput {
  projectId: string;
  currentChapter: number;
  readerPromises: ReaderPromise[];
  secrets: Secret[];
  knowledgeStates: KnowledgeState[];
  revealEvents?: RevealEvent[];
  relationships: RelationshipState[];
  relationshipTurningPoints?: RelationshipTurningPoint[];
  timelineLinks?: CausalLink[];
  appearances?: CharacterLocationAppearance[];
  travelDurations?: TravelDuration[];
  powerRules?: Array<{
    rule: PowerSystemRule;
    powerId: string;
    actorId: string;
    paidCosts: Array<{ kind: string; quantity: number; unit: string }>;
    requestRuleException?: boolean;
    exception?: {
      description: string;
      rationale: string;
      requestedBy: string;
    };
  }>;
}

export interface NarrativeHealthReport {
  projectId: string;
  promiseStates: Array<{ id: string; uiState: ReturnType<typeof getReaderPromiseUiState>; health: string }>;
  revealStates: Array<{ secretId: string; readerKnowledge: string }>;
  relationshipStates: Array<{ characterId: string; counterpartId: string; disposition: string; turningPoints: number }>;
  timelineIssues: string[];
  ruleIssues: string[];
  closureChecklist: ReturnType<typeof createClosureChecklist>;
  approvalSignals: Array<{ targetType: string; targetId: string; riskLevel: string; status: string }>;
}

export function createNarrativeHealthReport(input: NarrativeHealthReportInput): NarrativeHealthReport {
  const promises = input.readerPromises.map((promise) => {
    const assessment = assessReaderPromiseHealth(promise, {
      currentChapter: input.currentChapter,
      relatedEntitiesInScene: input.appearances
        ? input.appearances.flatMap((appearance) => appearance.characterIds.map((id) => ({ type: 'Character', id })))
        : promise.relatedEntities
    });

    return {
      id: promise.id,
      uiState: getReaderPromiseUiState({ ...promise, health: assessment.health }),
      health: assessment.health
    };
  });

  const revealStates = input.secrets.map((secret, index) => {
    const applied = applyRevealEvent(
      input.knowledgeStates[index] ?? { secretId: secret.id, readerKnowledge: { state: 'Unknown' }, characterKnowledge: {} },
      input.revealEvents?.[index] ?? { id: `reveal_${secret.id}`, secretId: secret.id, chapter: input.currentChapter }
    );

    return {
      secretId: secret.id,
      readerKnowledge: applied.readerKnowledge.state
    };
  });

  const relationshipStates = input.relationships.map((relationship, index) => {
    const turningPoint = input.relationshipTurningPoints?.[index];
    const updated = turningPoint
      ? transitionRelationshipState(relationship, 'Loyal', {
          reason: turningPoint.description,
          source: turningPoint.source,
          turningPoint
        })
      : relationship;

    return {
      characterId: updated.characterId,
      counterpartId: updated.counterpartId,
      disposition: updated.disposition,
      turningPoints: updated.turningPoints.length
    };
  });

  const timelineIssues: string[] = [];
  try {
    if (input.timelineLinks) {
      for (const link of input.timelineLinks) {
        createCausalLink(link);
      }
    }
    if (input.appearances && input.travelDurations) {
      assertCharacterLocationContinuity(input.appearances, input.travelDurations);
    }
  } catch (error) {
    timelineIssues.push(error instanceof Error ? error.message : 'Timeline validation failed');
  }

  const ruleIssues: string[] = [];
  const approvalSignals: Array<{ targetType: string; targetId: string; riskLevel: string; status: string }> = [];

  for (const powerRule of input.powerRules ?? []) {
    const result = validatePowerUse(powerRule.rule, {
      powerId: powerRule.powerId,
      actorId: powerRule.actorId,
      paidCosts: powerRule.paidCosts
    });

    if (!result.accepted) {
      ruleIssues.push(...result.violations.map((violation) => violation.message));
    }

    if (powerRule.requestRuleException && powerRule.exception) {
      const exception = createRuleException({
        projectId: input.projectId,
        ruleId: powerRule.rule.id,
        description: powerRule.exception.description,
        rationale: powerRule.exception.rationale,
        requestedBy: powerRule.exception.requestedBy
      });
      approvalSignals.push(exception.approvalSignal);
    }
  }

  const closureChecklist = createClosureChecklist({
    projectId: input.projectId,
    promises: input.readerPromises.map((promise) => ({
      id: promise.id,
      importance: promise.strength === 'Core' ? 'Core' : 'Side',
      status: promise.status === 'PaidOff' ? 'Resolved' : 'Open',
      summary: promise.title
    })),
    characterArcs: input.relationships.map((relationship) => ({
      id: `${relationship.characterId}:${relationship.counterpartId}`,
      characterId: relationship.characterId,
      importance: relationship.disposition === 'Loyal' ? 'Major' : 'Minor',
      status: relationship.disposition === 'Loyal' ? 'Closed' : 'Unresolved',
      summary: `${relationship.characterId} and ${relationship.counterpartId}`
    }))
  });

  return {
    projectId: input.projectId,
    promiseStates: promises,
    revealStates,
    relationshipStates,
    timelineIssues,
    ruleIssues,
    closureChecklist,
    approvalSignals
  };
}
