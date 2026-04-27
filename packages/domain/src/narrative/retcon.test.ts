import { describe, expect, it } from 'vitest';
import { createRetconProposal } from './retcon';

describe('createRetconProposal', () => {
  it('creates a retcon proposal with impact report, before/after diff, regression checks, and approval gate', () => {
    const proposal = createRetconProposal({
      projectId: 'project_abc',
      target: { type: 'CanonFact', id: 'canon_bell' },
      before: 'The bell is inert.',
      after: 'The bell is alive.',
      affected: {
        canonFacts: ['canon_bell'],
        manuscriptChapters: ['chapter_12'],
        timelineEvents: ['timeline_bell'],
        promises: ['promise_bell'],
        secrets: ['secret_bell'],
        worldRules: ['rule_living_relics']
      }
    });

    expect(proposal.impactReport.affected).toMatchObject({
      canonFacts: ['canon_bell'],
      manuscriptChapters: ['chapter_12'],
      timelineEvents: ['timeline_bell'],
      promises: ['promise_bell'],
      secrets: ['secret_bell'],
      worldRules: ['rule_living_relics']
    });
    expect(proposal.diff).toMatchObject({ before: 'The bell is inert.', after: 'The bell is alive.' });
    expect(proposal.regressionChecks.map((check) => check.scope)).toEqual([
      'canon',
      'manuscript',
      'timeline',
      'promise',
      'secret',
      'world_rule'
    ]);
    expect(proposal.approvalRisk).toBe('High');
    expect(proposal.approval.status).toBe('Pending');
  });
});
