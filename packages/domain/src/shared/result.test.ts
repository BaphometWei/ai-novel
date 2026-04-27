import { describe, expect, it } from 'vitest';
import { fail, ok } from './result';

describe('Result helpers', () => {
  it('represents success and failure without throwing', () => {
    expect(ok('value')).toEqual({ ok: true, value: 'value' });
    expect(fail('bad input')).toEqual({ ok: false, error: 'bad input' });
  });
});
