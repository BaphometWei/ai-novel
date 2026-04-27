import { describe, expect, it } from 'vitest';
import { rerankRetrievalItems } from './reranker';
import type { RetrievalItem } from './retrieval-policy';

function item(overrides: Partial<RetrievalItem> & Pick<RetrievalItem, 'id'>): RetrievalItem {
  return {
    kind: 'memory',
    entityKey: overrides.id,
    status: 'Draft',
    text: overrides.id,
    sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] },
    ...overrides
  };
}

describe('rerankRetrievalItems', () => {
  it('prioritizes canon, recent, authoritative, and promise items with trace scores', () => {
    const result = rerankRetrievalItems({
      query: 'river gate oath',
      items: [
        item({ id: 'draft_old', status: 'Draft', updatedAt: '2026-01-01T00:00:00.000Z' }),
        item({ id: 'promise', text: 'River gate oath must be resolved.', promise: true }),
        item({ id: 'authoritative', text: 'River gate dossier.', authoritative: true }),
        item({ id: 'recent', text: 'River gate rumor.', updatedAt: '2026-04-27T00:00:00.000Z' }),
        item({ id: 'canon', status: 'Canon', text: 'River gate canon.' })
      ],
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(result.included.map((ranked) => ranked.item.id)).toEqual([
      'canon',
      'recent',
      'authoritative',
      'promise',
      'draft_old'
    ]);
    expect(result.trace.map((entry) => entry.itemId)).toEqual([
      'canon',
      'recent',
      'authoritative',
      'promise',
      'draft_old'
    ]);
    expect(result.trace[0]).toMatchObject({ itemId: 'canon', reasons: expect.arrayContaining(['status:Canon']) });
  });

  it('excludes negative memory and restricted source policy items with reasons', () => {
    const result = rerankRetrievalItems({
      query: 'river gate',
      items: [
        item({ id: 'usable', status: 'Canon', text: 'River gate canon.' }),
        item({ id: 'negative', status: 'Conflict', text: 'Wrong river gate memory.' }),
        item({
          id: 'restricted',
          text: 'Restricted style sample.',
          sourcePolicy: { allowedUse: ['analysis'], prohibitedUse: ['generation_support'] }
        })
      ]
    });

    expect(result.included.map((ranked) => ranked.item.id)).toEqual(['usable']);
    expect(result.excluded).toEqual([
      { itemId: 'negative', reason: 'negative_memory:Conflict' },
      { itemId: 'restricted', reason: 'restricted_source_policy:generation_support' }
    ]);
  });
});
