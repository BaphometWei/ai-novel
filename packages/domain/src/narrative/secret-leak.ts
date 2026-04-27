import type { KnowledgeState, KnowledgeValue, Secret } from './secrets';

export type SecretExposureSource = 'Manuscript' | 'AgentOutput';
export type SecretAudience = 'Reader' | 'Character';
export type SecretLeakSeverity = 'Low' | 'Medium' | 'High';

export interface PlannedReveal {
  secretId: string;
  chapter: number;
  audience: SecretAudience;
  characterId?: string;
}

export interface SecretExposure {
  id: string;
  source: SecretExposureSource;
  audience: SecretAudience;
  characterId?: string;
  text: string;
}

export interface SecretLeakFinding {
  secretId: string;
  source: SecretExposureSource;
  exposureId: string;
  audience: SecretAudience;
  characterId?: string;
  plannedRevealChapter?: number;
  severity: SecretLeakSeverity;
  evidence: string;
}

export function detectSecretLeaks(input: {
  currentChapter: number;
  secrets: readonly Secret[];
  knowledgeStates: readonly KnowledgeState[];
  plannedReveals: readonly PlannedReveal[];
  exposures: readonly SecretExposure[];
}): SecretLeakFinding[] {
  return input.secrets.flatMap((secret) => {
    if (secret.status !== 'Hidden') return [];

    const knowledge = input.knowledgeStates.find((state) => state.secretId === secret.id);
    const matchingExposures = input.exposures.filter((exposure) => exposesSecret(exposure.text, secret));

    return matchingExposures.flatMap((exposure) => {
      if (audienceKnows(exposure, knowledge)) return [];

      const plannedReveal = findPlannedReveal(secret.id, exposure, input.plannedReveals);
      if (plannedReveal && input.currentChapter >= plannedReveal.chapter) return [];

      return [
        {
          secretId: secret.id,
          source: exposure.source,
          exposureId: exposure.id,
          audience: exposure.audience,
          ...(exposure.characterId ? { characterId: exposure.characterId } : {}),
          ...(plannedReveal ? { plannedRevealChapter: plannedReveal.chapter } : {}),
          severity: 'High',
          evidence: exposure.text
        }
      ];
    });
  });
}

function exposesSecret(text: string, secret: Secret): boolean {
  const normalizedText = normalize(text);
  return normalizedText.includes(normalize(secret.hiddenTruth)) || normalizedText.includes(normalize(secret.title));
}

function audienceKnows(exposure: SecretExposure, knowledge?: KnowledgeState): boolean {
  if (!knowledge) return false;
  if (exposure.audience === 'Reader') return knows(knowledge.readerKnowledge.state);
  if (!exposure.characterId) return false;
  return knows(knowledge.characterKnowledge[exposure.characterId]?.state);
}

function knows(state?: KnowledgeValue): boolean {
  return state === 'Knows';
}

function findPlannedReveal(
  secretId: string,
  exposure: SecretExposure,
  plannedReveals: readonly PlannedReveal[]
): PlannedReveal | undefined {
  return plannedReveals.find(
    (reveal) =>
      reveal.secretId === secretId &&
      reveal.audience === exposure.audience &&
      (reveal.audience === 'Reader' || reveal.characterId === exposure.characterId)
  );
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
