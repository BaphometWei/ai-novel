import { describe, expect, it } from 'vitest';
import { buildGenerationSourceContext, canUseSourceFor, createKnowledgeItem, createSourcePolicy } from './knowledge';

describe('SourcePolicy', () => {
  it('allows analysis while blocking generation support for restricted samples', () => {
    const policy = createSourcePolicy({
      sourceType: 'web_excerpt',
      allowedUse: ['analysis'],
      prohibitedUse: ['generation_support'],
      attributionRequirements: 'cite source',
      licenseNotes: 'unknown',
      similarityRisk: 'High'
    });

    expect(canUseSourceFor(policy, 'analysis')).toBe(true);
    expect(canUseSourceFor(policy, 'generation_support')).toBe(false);
  });

  it('records ingested knowledge lifecycle metadata and material policy', () => {
    const policy = createSourcePolicy({
      sourceType: 'licensed',
      allowedUse: ['analysis', 'structure'],
      prohibitedUse: ['generation_support'],
      attributionRequirements: 'keep source attribution',
      licenseNotes: 'reference only',
      similarityRisk: 'Medium'
    });

    const item = createKnowledgeItem({
      title: 'Reversal technique',
      kind: 'Technique',
      lifecycleStatus: 'Active',
      material: {
        sourceTitle: 'Craft notes',
        sourcePolicy: policy,
        extractedSummary: 'Reverse the apparent victory into a cost.'
      },
      tags: ['plot', 'reversal']
    });

    expect(item.material.sourcePolicy.id).toBe(policy.id);
    expect(item.lifecycleStatus).toBe('Active');
    expect(item.tags).toEqual(['plot', 'reversal']);
  });

  it('excludes restricted samples from generation source context', () => {
    const allowedPolicy = createSourcePolicy({
      sourceType: 'user_note',
      allowedUse: ['generation_support'],
      prohibitedUse: [],
      attributionRequirements: 'none',
      licenseNotes: 'owned',
      similarityRisk: 'Low'
    });
    const restrictedPolicy = createSourcePolicy({
      sourceType: 'web_excerpt',
      allowedUse: ['analysis'],
      prohibitedUse: ['generation_support'],
      attributionRequirements: 'cite source',
      licenseNotes: 'unknown',
      similarityRisk: 'High'
    });
    const allowed = createKnowledgeItem({
      title: 'Owned setting note',
      kind: 'WorldTemplate',
      lifecycleStatus: 'Active',
      material: { sourceTitle: 'Author note', sourcePolicy: allowedPolicy, extractedSummary: 'A floating archive city.' },
      tags: ['world']
    });
    const restricted = createKnowledgeItem({
      title: 'Sample fight cadence',
      kind: 'Sample',
      lifecycleStatus: 'Active',
      material: { sourceTitle: 'Web excerpt', sourcePolicy: restrictedPolicy, extractedSummary: 'Punchy cadence sample.' },
      tags: ['style']
    });

    const context = buildGenerationSourceContext([allowed, restricted]);

    expect(context.included.map((item) => item.id)).toEqual([allowed.id]);
    expect(context.exclusions).toEqual([
      { knowledgeItemId: restricted.id, reason: 'Source policy prohibits generation support' }
    ]);
  });
});
