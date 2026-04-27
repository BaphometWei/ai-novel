import { describe, expect, it } from 'vitest';
import {
  applyRevealEvent,
  canCharacterUseSecret,
  createKnowledgeState,
  createSecret
} from './secrets';

describe('Secrets and reveals', () => {
  it('prevents a character from using a secret before their knowledge state says they know it', () => {
    const secret = createSecret({
      id: 'secret_heir_identity',
      projectId: 'project_abc',
      title: 'Mei is the lost heir',
      hiddenTruth: 'Mei is the lost heir to the western court',
      status: 'Hidden'
    });

    const knowledge = createKnowledgeState({ secretId: secret.id });

    expect(canCharacterUseSecret(secret, 'mei', knowledge)).toBe(false);
  });

  it('updates reader and character knowledge separately when a reveal occurs', () => {
    const secret = createSecret({
      id: 'secret_traitor',
      projectId: 'project_abc',
      title: 'The quartermaster is the traitor',
      hiddenTruth: 'The quartermaster sold the route map',
      status: 'Hidden'
    });

    const knowledge = createKnowledgeState({
      secretId: secret.id,
      characterKnowledge: {
        captain: { state: 'Knows', learnedAtChapter: 7 }
      }
    });

    const updated = applyRevealEvent(knowledge, {
      id: 'reveal_traitor_reader',
      secretId: secret.id,
      chapter: 9,
      readerReveal: { state: 'Knows' },
      characterReveals: {
        scout: { state: 'Suspects' }
      }
    });

    expect(updated.readerKnowledge).toEqual({ state: 'Knows', learnedAtChapter: 9 });
    expect(updated.characterKnowledge).toEqual({
      captain: { state: 'Knows', learnedAtChapter: 7 },
      scout: { state: 'Suspects', learnedAtChapter: 9 }
    });
    expect(canCharacterUseSecret(secret, 'captain', updated)).toBe(true);
    expect(canCharacterUseSecret(secret, 'scout', updated)).toBe(false);
  });
});
