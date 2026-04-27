import type { KnowledgeState, KnowledgeValue, Secret } from './secrets';

export type RevealPlanAction = 'hold' | 'reveal' | 'misdirect';
export type RevealPlanRisk = 'Low' | 'Medium' | 'High';

export type RevealTargetAudience = { type: 'Reader' } | { type: 'Character'; characterId: string };

export interface RevealPlan {
  action: RevealPlanAction;
  targetAudience: RevealTargetAudience;
  risk: RevealPlanRisk;
  evidence: string[];
  reason: string;
}

export function planSecretReveal(input: {
  secret: Secret;
  knowledge: KnowledgeState;
  currentChapter: number;
  plannedRevealChapter: number;
  targetAudience: RevealTargetAudience;
  evidence: string[];
}): RevealPlan {
  const audienceKnowledge = getAudienceKnowledge(input.knowledge, input.targetAudience);

  if (audienceKnowledge === 'Knows') {
    return {
      action: 'hold',
      targetAudience: input.targetAudience,
      risk: 'Low',
      evidence: input.evidence,
      reason: 'Target audience already knows this secret.'
    };
  }

  if (input.currentChapter < input.plannedRevealChapter) {
    return {
      action: 'hold',
      targetAudience: input.targetAudience,
      risk: 'Medium',
      evidence: input.evidence,
      reason: `Reveal is scheduled for chapter ${input.plannedRevealChapter}; keep the ${audienceLabel(
        input.targetAudience
      )} at ${audienceKnowledge}.`
    };
  }

  if (input.evidence.length === 0) {
    return {
      action: 'misdirect',
      targetAudience: input.targetAudience,
      risk: 'High',
      evidence: input.evidence,
      reason: 'Reveal is due, but no supporting evidence is present.'
    };
  }

  return {
    action: 'reveal',
    targetAudience: input.targetAudience,
    risk: 'Low',
    evidence: input.evidence,
    reason: `Reveal is due in chapter ${input.currentChapter} with supporting evidence.`
  };
}

function getAudienceKnowledge(knowledge: KnowledgeState, targetAudience: RevealTargetAudience): KnowledgeValue {
  if (targetAudience.type === 'Reader') return knowledge.readerKnowledge.state;
  return knowledge.characterKnowledge[targetAudience.characterId]?.state ?? 'Unknown';
}

function audienceLabel(targetAudience: RevealTargetAudience): string {
  return targetAudience.type === 'Reader' ? 'reader' : targetAudience.characterId;
}
