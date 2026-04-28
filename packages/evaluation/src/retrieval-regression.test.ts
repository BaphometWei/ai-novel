import { describe, expect, it } from 'vitest';
import { longformRetrievalCorpus } from './fixtures/longform-corpus';
import { defaultQualityThresholdConfig, parseQualityThresholdConfig } from './quality-thresholds';
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
    expect(result.thresholds).toEqual({
      requiredCoverage: 1,
      forbiddenLeakage: 0
    });
    expect(result.includedIds).toEqual(['fact_banned']);
    expect(result.excludedIds).toEqual(['fact_password']);
    expect(result.triageHints).toEqual([
      {
        itemId: 'fact_password',
        severity: 'blocking',
        message: 'Required retrieval item fact_password was excluded: ranked_below_limit.'
      },
      {
        itemId: 'fact_banned',
        severity: 'blocking',
        message: 'Forbidden retrieval item fact_banned was included in context.'
      }
    ]);
  });

  it('ships longform fixture cases covering canon facts, forbidden samples, promises, and secrets', () => {
    expect(longformRetrievalCorpus.canonFacts.map((item) => item.id)).toContain('canon_lyra_vow_clocktower');
    expect(longformRetrievalCorpus.forbiddenSourceSamples.map((item) => item.id)).toContain('sample_banned_duelist_voice');
    expect(longformRetrievalCorpus.promises.map((item) => item.id)).toContain('promise_silver_weatherglass');
    expect(longformRetrievalCorpus.secrets.map((item) => item.id)).toContain('secret_heir_false_name');
    expect(longformRetrievalCorpus.regressionCases).toHaveLength(2);

    const results = longformRetrievalCorpus.regressionCases.map(evaluateRetrievalRegression);

    expect(results.map((result) => result.caseId)).toEqual([
      'longform_clocktower_vow_recall',
      'longform_forbidden_style_leak'
    ]);
    expect(results[0].passed).toBe(true);
    expect(results[1].failures).toEqual([
      { type: 'must_include_missing', itemId: 'canon_lyra_vow_clocktower' },
      { type: 'forbidden_included', itemId: 'sample_banned_duelist_voice' }
    ]);
  });

  it('uses configured retrieval thresholds in synthetic reports', () => {
    const config = parseQualityThresholdConfig({
      retrieval: {
        requiredCoverage: 0.5,
        forbiddenLeakage: 0.5
      }
    });

    const result = evaluateRetrievalRegression({
      caseId: 'case_partial_local_threshold',
      projectId: 'project_demo',
      query: 'clocktower vow',
      policy: { id: 'policy_synthetic' },
      thresholds: config.retrieval,
      mustInclude: [
        { id: 'canon_lyra_vow_clocktower', text: 'Lyra vowed at the clocktower.' },
        { id: 'promise_silver_weatherglass', text: 'The silver weatherglass must pay off.' }
      ],
      forbidden: [
        { id: 'sample_banned_duelist_voice', text: 'Restricted duelist voice.' },
        { id: 'sample_private_letter_cadence', text: 'Private letter cadence.' }
      ],
      included: [
        { id: 'canon_lyra_vow_clocktower', text: 'Lyra vowed at the clocktower.' },
        { id: 'sample_banned_duelist_voice', text: 'Restricted duelist voice.' }
      ],
      excluded: [
        { id: 'promise_silver_weatherglass', reason: 'ranked_below_limit' },
        { id: 'sample_private_letter_cadence', reason: 'restricted_source_sample' }
      ]
    });

    expect(defaultQualityThresholdConfig.source).toBe('synthetic-local-defaults');
    expect(result.thresholds).toEqual({ requiredCoverage: 0.5, forbiddenLeakage: 0.5 });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([
      { type: 'must_include_missing', itemId: 'promise_silver_weatherglass' },
      { type: 'forbidden_included', itemId: 'sample_banned_duelist_voice' }
    ]);
  });
});
