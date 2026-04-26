import { describe, expect, it } from 'vitest';
import { buildContextPack } from './context-builder';

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
});
