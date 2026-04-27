import { describe, expect, it } from 'vitest';
import { createContextPack } from './context-pack';

describe('createContextPack', () => {
  it('stores citations, warnings, exclusions, and retrieval trace', () => {
    const pack = createContextPack({
      taskGoal: 'Draft a scene',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'Hero is injured.' }],
      citations: [{ sourceId: 'canon_fact_1', quote: 'Hero is injured.' }],
      exclusions: ['restricted_sample_1'],
      warnings: ['Timeline deadline nearby'],
      retrievalTrace: ['keyword: hero injury']
    });

    expect(pack.citations).toEqual([{ sourceId: 'canon_fact_1', quote: 'Hero is injured.' }]);
    expect(pack.exclusions).toEqual(['restricted_sample_1']);
    expect(pack.warnings).toEqual(['Timeline deadline nearby']);
    expect(pack.retrievalTrace).toEqual(['keyword: hero injury']);
  });
});
