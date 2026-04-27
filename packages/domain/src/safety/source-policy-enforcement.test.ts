import { describe, expect, it } from 'vitest';
import { createSourcePolicy } from '../knowledge/knowledge';
import { enforceSourcePolicyForGeneration } from './source-policy-enforcement';

describe('enforceSourcePolicyForGeneration', () => {
  it('requires approval when restricted or high-similarity-risk material is requested for generation support', () => {
    const policy = createSourcePolicy({
      sourceType: 'web_excerpt',
      allowedUse: ['analysis'],
      prohibitedUse: ['generation_support'],
      attributionRequirements: 'cite source',
      licenseNotes: 'analysis only',
      similarityRisk: 'High'
    });

    const result = enforceSourcePolicyForGeneration({
      projectId: 'project_abc',
      targetId: 'knowledge_item_abc',
      policy
    });

    expect(result.allowed).toBe(false);
    expect(result.approvalRequest).toMatchObject({
      projectId: 'project_abc',
      targetType: 'KnowledgeItem',
      targetId: 'knowledge_item_abc',
      riskLevel: 'Blocking'
    });
  });
});
