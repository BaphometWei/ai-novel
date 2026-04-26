import { describe, expect, it } from 'vitest';
import { createFixedClock } from './clock';

describe('createFixedClock', () => {
  it('returns the same timestamp for deterministic domain factories', () => {
    const clock = createFixedClock('2026-04-27T00:00:00.000Z');

    expect(clock.now()).toBe('2026-04-27T00:00:00.000Z');
  });
});
