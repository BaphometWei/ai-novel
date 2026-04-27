import { describe, expect, it } from 'vitest';
import { buildContextPack } from './context-builder';
import type { RetrievalItem } from './retrieval-policy';

describe('buildContextPack', () => {
  it('prefers Canon memory over Draft memory for the same entity', () => {
    const pack = buildContextPack({
      taskGoal: 'Draft a scene about the protagonist',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      query: 'protagonist water',
      items: [
        {
          id: 'draft_1',
          kind: 'memory',
          entityKey: 'protagonist:fear',
          status: 'Draft',
          text: 'The protagonist dislikes rain.',
          sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
        },
        {
          id: 'canon_1',
          kind: 'memory',
          entityKey: 'protagonist:fear',
          status: 'Canon',
          text: 'The protagonist fears deep water.',
          sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
        }
      ]
    });

    expect(pack.sections[0].content).toContain('The protagonist fears deep water.');
    expect(pack.sections[0].content).not.toContain('The protagonist dislikes rain.');
    expect(pack.citations).toEqual([{ sourceId: 'canon_1', quote: 'The protagonist fears deep water.' }]);
  });

  it('excludes restricted source policy items from generation context', () => {
    const pack = buildContextPack({
      taskGoal: 'Draft a scene',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      query: 'style sample',
      items: [
        {
          id: 'sample_1',
          kind: 'sample',
          entityKey: 'sample:restricted',
          status: 'Draft',
          text: 'A protected sample passage.',
          sourcePolicy: { allowedUse: ['analysis'], prohibitedUse: ['generation_support'] }
        }
      ]
    });

    expect(pack.sections[0].content).toBe('');
    expect(pack.exclusions).toEqual(['sample_1']);
    expect(pack.warnings).toEqual(['Excluded sample_1 due to source policy']);
  });

  it('excludes Conflict and Deprecated memory from generation context', () => {
    const pack = buildContextPack({
      taskGoal: 'Draft a scene',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      query: 'protagonist',
      items: [
        {
          id: 'conflict_1',
          kind: 'memory',
          entityKey: 'protagonist:origin',
          status: 'Conflict',
          text: 'The protagonist was born in two incompatible places.',
          sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
        },
        {
          id: 'deprecated_1',
          kind: 'memory',
          entityKey: 'protagonist:weapon',
          status: 'Deprecated',
          text: 'The protagonist uses the old sword.',
          sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
        }
      ]
    });

    expect(pack.sections[0].content).toBe('');
    expect(pack.exclusions).toEqual(['conflict_1', 'deprecated_1']);
    expect(pack.warnings).toEqual([
      'Excluded conflict_1 because memory status is Conflict',
      'Excluded deprecated_1 because memory status is Deprecated'
    ]);
  });

  it('ranks higher-value items first and compresses oversized context sections', () => {
    const pack = buildContextPack({
      taskGoal: 'Draft a scene with a strong canon anchor',
      agentRole: 'Writer Agent',
      riskLevel: 'High',
      query: 'archive city bell canon',
      maxContextItems: 2,
      maxSectionChars: 80,
      items: [
        {
          id: 'review_1',
          kind: 'review',
          entityKey: 'scene:review',
          status: 'Draft',
          text: 'Review note: bell timing is off.',
          sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
        },
        {
          id: 'canon_1',
          kind: 'memory',
          entityKey: 'world:archive',
          status: 'Canon',
          text: 'Canon: the archive city floats above the lower district and the bell governs access during storms.',
          sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
        },
        {
          id: 'manuscript_1',
          kind: 'manuscript',
          entityKey: 'chapter:scene',
          status: 'Draft',
          text: 'The bell rings three times before the gate opens.',
          sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
        }
      ]
    });

    expect(pack.sections[0].content.split('\n')).toHaveLength(2);
    expect(pack.sections[0].content).toContain('Canon: the archive city floats above...');
    expect(pack.sections[0].content.length).toBeLessThanOrEqual(80);
    expect(pack.citations.map((citation) => citation.sourceId)).toEqual(['canon_1', 'manuscript_1']);
    expect(pack.retrievalTrace).toEqual([
      'query:archive city bell canon',
      'ranked:3',
      'selected:2',
      'excluded:0',
      'maxContextItems:2',
      'maxSectionChars:80'
    ]);
  });

  it('produces rerank and compression traces via reranker/compressor', () => {
    const items: RetrievalItem[] = [
      {
        id: 'a',
        kind: 'memory',
        entityKey: 'k1',
        status: 'Draft',
        text: 'alpha beta gamma delta',
        sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
      },
      {
        id: 'b',
        kind: 'memory',
        entityKey: 'k2',
        status: 'Canon',
        text: 'canon content with matching terms alpha',
        sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] }
      }
    ];

    const pack = buildContextPack({
      taskGoal: 'Test rerank/compress',
      agentRole: 'Agent',
      riskLevel: 'Low',
      query: 'alpha',
      maxContextItems: 2,
      maxSectionChars: 40,
      items
    });

    // retrievalTrace should still be present
    expect(pack.retrievalTrace[0]).toContain('query:alpha');
    // citations should reflect compressor output (quotes present)
    expect(pack.citations.length).toBeGreaterThan(0);
    // ensure the Canon item is included first (reranker effect)
    expect(pack.citations[0].sourceId).toBe('b');
  });
});
