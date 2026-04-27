import { describe, expect, it } from 'vitest';
import { compressContextItems } from './context-compressor';
import type { RetrievalItem } from './retrieval-policy';

function item(overrides: Partial<RetrievalItem> & Pick<RetrievalItem, 'id' | 'text'>): RetrievalItem {
  return {
    kind: 'memory',
    entityKey: overrides.id,
    status: 'Draft',
    sourcePolicy: { allowedUse: ['generation_support'], prohibitedUse: [] },
    ...overrides
  };
}

describe('compressContextItems', () => {
  it('preserves must-have constraints and citations while compressing low-priority content with trace', () => {
    const result = compressContextItems({
      items: [
        item({ id: 'must', text: 'MUST HAVE: The river gate password is lantern.' }),
        item({
          id: 'low',
          text: 'Background texture repeats across the city market and can be shortened without losing the constraint.'
        })
      ],
      mustHaveItemIds: ['must'],
      maxSectionChars: 90
    });

    expect(result.items.map((compressed) => compressed.id)).toEqual(['must', 'low']);
    expect(result.items[0].text).toBe('MUST HAVE: The river gate password is lantern.');
    expect(result.citations).toEqual([
      { sourceId: 'must', quote: 'MUST HAVE: The river gate password is lantern.' },
      { sourceId: 'low', quote: expect.stringContaining('...') }
    ]);
    expect(result.items[1].text.length).toBeLessThan('Background texture repeats across the city market and can be shortened without losing the constraint.'.length);
    expect(result.trace).toEqual(
      expect.arrayContaining([
        { itemId: 'must', action: 'preserved', originalLength: 46, compressedLength: 46, reason: 'must_have' },
        expect.objectContaining({ itemId: 'low', action: 'compressed', reason: 'budget' })
      ])
    );
  });
});
