import { describe, expect, it } from 'vitest';
import { evaluateSimilarityGuard } from './similarity-guard';

describe('evaluateSimilarityGuard', () => {
  it('blocks generated prose that crosses similarity threshold against protected samples without storing protected text', () => {
    const result = evaluateSimilarityGuard({
      generatedText: 'The silver bell wakes when the drowned city rises.',
      threshold: 0.7,
      protectedSamples: [
        {
          sampleId: 'sample_protected',
          text: 'The silver bell wakes when the drowned city rises.',
          policyId: 'source_policy_high'
        }
      ]
    });

    expect(result.status).toBe('Blocked');
    expect(result.evidence[0]).toMatchObject({ sampleId: 'sample_protected', similarity: 1 });
    expect(JSON.stringify(result)).not.toContain('drowned city rises');
  });
});
