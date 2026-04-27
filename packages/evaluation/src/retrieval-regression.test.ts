import { describe, expect, it } from 'vitest';
import { evaluateRetrievalRegression } from './retrieval-regression';

describe('evaluateRetrievalRegression', () => {
  it('fails when must-include facts are missing and forbidden facts are included with a snapshot', () => {
    const result = evaluateRetrievalRegression({
      caseId: 'case_river_gate',
      projectId: 'project_demo',
      query: 'river gate password',
      policy: { id: 'policy_v3', description: 'V3 retrieval policy' },
      mustInclude: [{ id: 'fact_password', text: 'The password is lantern.' }],
      forbidden: [{ id: 'fact_banned', text: 'The password is sword.' }],
      included: [{ id: 'fact_banned', text: 'The password is sword.' }],
      excluded: [{ id: 'fact_password', reason: 'ranked_below_limit' }]
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual([
      { type: 'must_include_missing', itemId: 'fact_password' },
      { type: 'forbidden_included', itemId: 'fact_banned' }
    ]);
    expect(result.snapshot).toEqual({
      query: 'river gate password',
      policy: { id: 'policy_v3', description: 'V3 retrieval policy' },
      included: [{ id: 'fact_banned', text: 'The password is sword.' }],
      excluded: [{ id: 'fact_password', reason: 'ranked_below_limit' }],
      failures: [
        { type: 'must_include_missing', itemId: 'fact_password' },
        { type: 'forbidden_included', itemId: 'fact_banned' }
      ]
    });
  });
});
