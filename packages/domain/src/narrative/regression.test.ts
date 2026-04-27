import { describe, expect, it } from 'vitest';
import { runNarrativeRegressionChecks } from './regression';

describe('runNarrativeRegressionChecks', () => {
  it('blocks branch adoption when regression checks fail across canon, manuscript, timeline, promise, secret, or world-rule state', () => {
    const result = runNarrativeRegressionChecks([
      { scope: 'canon', status: 'Failed', evidence: ['canon_bell conflict'] },
      { scope: 'manuscript', status: 'Passed', evidence: ['chapter references agree'] },
      { scope: 'timeline', status: 'Failed', evidence: ['chapter_12 impossible travel'] },
      { scope: 'promise', status: 'Passed', evidence: ['promise payoff intact'] },
      { scope: 'secret', status: 'Failed', evidence: ['secret revealed too early'] },
      { scope: 'world_rule', status: 'Passed', evidence: ['rule constraints intact'] }
    ]);

    expect(result.status).toBe('Blocked');
    expect(result.failures.map((failure) => failure.scope)).toEqual(['canon', 'timeline', 'secret']);
  });

  it('requires every regression scope to pass with evidence before adoption is allowed', () => {
    const result = runNarrativeRegressionChecks([
      { scope: 'canon', status: 'Passed', evidence: ['canon facts agree'] },
      { scope: 'manuscript', status: 'Passed', evidence: ['chapters 1-3 reviewed'] },
      { scope: 'timeline', status: 'Passed', evidence: ['timeline order valid'] },
      { scope: 'promise', status: 'Passed', evidence: [] },
      { scope: 'secret', status: 'Pending', evidence: ['secret timing queued'] }
    ]);

    expect(result.status).toBe('Blocked');
    expect(result.failures).toEqual([
      { scope: 'promise', status: 'Failed', evidence: ['Missing regression evidence for promise'] },
      { scope: 'secret', status: 'Failed', evidence: ['Regression check for secret is Pending'] },
      { scope: 'world_rule', status: 'Failed', evidence: ['Missing required regression check for world_rule'] }
    ]);
  });

  it('passes when canon, manuscript, timeline, promise, secret, and world-rule checks all pass with evidence', () => {
    const result = runNarrativeRegressionChecks([
      { scope: 'canon', status: 'Passed', evidence: ['canon facts agree'] },
      { scope: 'manuscript', status: 'Passed', evidence: ['chapter references agree'] },
      { scope: 'timeline', status: 'Passed', evidence: ['event order agrees'] },
      { scope: 'promise', status: 'Passed', evidence: ['promise setup/payoff intact'] },
      { scope: 'secret', status: 'Passed', evidence: ['secret reveal timing intact'] },
      { scope: 'world_rule', status: 'Passed', evidence: ['rule constraints intact'] }
    ]);

    expect(result.status).toBe('Passed');
    expect(result.failures).toEqual([]);
  });
});
