import { describe, expect, it } from 'vitest';
import { createKnowledgeState, createSecret } from './secrets';
import { planSecretReveal } from './reveal-planner';

describe('Secret reveal planner', () => {
  it('suggests holding a secret when the audience is still before the reveal chapter', () => {
    const secret = createSecret({
      id: 'secret_heir_identity',
      projectId: 'project_abc',
      title: 'Mei is the lost heir',
      hiddenTruth: 'Mei is the lost heir to the western court',
      status: 'Hidden'
    });

    const plan = planSecretReveal({
      secret,
      knowledge: createKnowledgeState({ secretId: secret.id }),
      currentChapter: 4,
      plannedRevealChapter: 9,
      targetAudience: { type: 'Reader' },
      evidence: ['Court seal appears in chapter 4']
    });

    expect(plan).toEqual({
      action: 'hold',
      targetAudience: { type: 'Reader' },
      risk: 'Medium',
      evidence: ['Court seal appears in chapter 4'],
      reason: 'Reveal is scheduled for chapter 9; keep the reader at Unknown.'
    });
  });

  it('suggests reveal when the target audience has reached the planned chapter with supporting evidence', () => {
    const secret = createSecret({
      id: 'secret_traitor',
      projectId: 'project_abc',
      title: 'The quartermaster is the traitor',
      hiddenTruth: 'The quartermaster sold the route map',
      status: 'Hidden'
    });

    const plan = planSecretReveal({
      secret,
      knowledge: createKnowledgeState({ secretId: secret.id }),
      currentChapter: 9,
      plannedRevealChapter: 9,
      targetAudience: { type: 'Character', characterId: 'captain' },
      evidence: ['The captain finds the payment ledger']
    });

    expect(plan.action).toBe('reveal');
    expect(plan.targetAudience).toEqual({ type: 'Character', characterId: 'captain' });
    expect(plan.risk).toBe('Low');
    expect(plan.evidence).toEqual(['The captain finds the payment ledger']);
  });

  it('suggests misdirect when evidence is missing at the planned reveal point', () => {
    const secret = createSecret({
      id: 'secret_traitor',
      projectId: 'project_abc',
      title: 'The quartermaster is the traitor',
      hiddenTruth: 'The quartermaster sold the route map',
      status: 'Hidden'
    });

    const plan = planSecretReveal({
      secret,
      knowledge: createKnowledgeState({ secretId: secret.id }),
      currentChapter: 9,
      plannedRevealChapter: 9,
      targetAudience: { type: 'Reader' },
      evidence: []
    });

    expect(plan.action).toBe('misdirect');
    expect(plan.risk).toBe('High');
    expect(plan.reason).toBe('Reveal is due, but no supporting evidence is present.');
  });
});
