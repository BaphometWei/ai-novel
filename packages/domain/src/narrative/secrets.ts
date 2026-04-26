export type SecretStatus = 'Hidden' | 'Revealed';
export type KnowledgeValue = 'Unknown' | 'Suspects' | 'Knows';

export interface Secret {
  id: string;
  projectId: string;
  title: string;
  hiddenTruth: string;
  status: SecretStatus;
}

export interface KnowledgeEntry {
  state: KnowledgeValue;
  learnedAtChapter?: number;
}

export interface KnowledgeState {
  secretId: string;
  readerKnowledge: KnowledgeEntry;
  characterKnowledge: Record<string, KnowledgeEntry>;
}

export interface RevealEvent {
  id: string;
  secretId: string;
  chapter: number;
  readerReveal?: { state: KnowledgeValue };
  characterReveals?: Record<string, { state: KnowledgeValue }>;
}

export function createSecret(input: Secret): Secret {
  return input;
}

export function createKnowledgeState(input: {
  secretId: string;
  readerKnowledge?: KnowledgeEntry;
  characterKnowledge?: Record<string, KnowledgeEntry>;
}): KnowledgeState {
  return {
    readerKnowledge: { state: 'Unknown' },
    characterKnowledge: {},
    ...input
  };
}

export function canCharacterUseSecret(_secret: Secret, characterId: string, knowledge: KnowledgeState): boolean {
  return knowledge.characterKnowledge[characterId]?.state === 'Knows';
}

export function applyRevealEvent(knowledge: KnowledgeState, event: RevealEvent): KnowledgeState {
  if (event.secretId !== knowledge.secretId) {
    return knowledge;
  }

  const characterKnowledge = { ...knowledge.characterKnowledge };
  for (const [characterId, entry] of Object.entries(event.characterReveals ?? {})) {
    characterKnowledge[characterId] = { state: entry.state, learnedAtChapter: event.chapter };
  }

  return {
    ...knowledge,
    readerKnowledge: event.readerReveal
      ? { state: event.readerReveal.state, learnedAtChapter: event.chapter }
      : knowledge.readerKnowledge,
    characterKnowledge
  };
}
