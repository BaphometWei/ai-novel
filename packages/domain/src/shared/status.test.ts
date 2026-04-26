import { describe, expect, it } from 'vitest';
import { canTransitionMemoryStatus } from './status';

describe('canTransitionMemoryStatus', () => {
  it('allows only governed memory transitions', () => {
    expect(canTransitionMemoryStatus('Candidate', 'Draft')).toBe(true);
    expect(canTransitionMemoryStatus('Draft', 'Canon')).toBe(true);
    expect(canTransitionMemoryStatus('Canon', 'Candidate')).toBe(false);
  });
});
