import { describe, expect, it } from 'vitest';
import { createPromptRegistry } from './prompt-registry';

describe('Prompt registry', () => {
  it('requires every prompt id to resolve to a versioned prompt definition', () => {
    const registry = createPromptRegistry([
      {
        id: 'writer.v2.1',
        taskType: 'draft_prose',
        template: 'Write {{goal}}',
        model: 'gpt-test',
        provider: 'openai',
        version: 1,
        status: 'Active'
      }
    ]);

    expect(registry.resolve('writer.v2.1')).toMatchObject({ taskType: 'draft_prose', version: 1 });
    expect(() => registry.resolve('missing')).toThrow(/PromptVersion/);
  });
});
