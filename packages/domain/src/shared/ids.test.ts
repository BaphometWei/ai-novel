import { describe, expect, it } from 'vitest';
import { createId } from './ids';

describe('createId', () => {
  it('prefixes generated ids with the entity type', () => {
    const id = createId('project');

    expect(id).toMatch(/^project_[a-z0-9]+$/);
  });
});
