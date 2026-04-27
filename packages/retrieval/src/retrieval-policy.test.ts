import { describe, expect, it } from 'vitest';
import { compressText } from './retrieval-policy';

describe('compressText', () => {
  it('uses an ASCII truncation marker while respecting the character budget', () => {
    const compressed = compressText('The archive city bell rings through the lower district.', 24);

    expect(compressed).toBe('The archive city bell...');
    expect(compressed).toHaveLength(24);
  });
});
