import { describe, expect, it } from 'vitest';
import { assertAgentCanRunTask, defineAgentRoles } from './agents';

describe('agent roles', () => {
  it('defines typed artifact contracts for the full creative room', () => {
    const roles = defineAgentRoles();

    expect(roles.map((role) => role.name)).toEqual([
      'Chief Editor',
      'Planner',
      'Lore Keeper',
      'Writer',
      'Editor',
      'Continuity Sentinel',
      'Voice Director',
      'Research',
      'Market Analyst',
      'Serialization',
      'Memory Curator'
    ]);
    expect(roles.every((role) => role.outputArtifact.type.length > 0)).toBe(true);
    expect(roles.find((role) => role.name === 'Writer')?.outputArtifact).toMatchObject({
      type: 'draft_prose',
      ownership: 'agent_draft_until_author_acceptance'
    });
  });

  it('rejects task types that do not match the selected role', () => {
    expect(() => assertAgentCanRunTask('Planner', 'chapter_planning')).not.toThrow();
    expect(() => assertAgentCanRunTask('Planner', 'writing_draft')).toThrow(
      'Agent role Planner cannot run task type writing_draft'
    );
    expect(() => assertAgentCanRunTask('Unknown', 'chapter_planning')).toThrow('Unknown agent role: Unknown');
  });
});
