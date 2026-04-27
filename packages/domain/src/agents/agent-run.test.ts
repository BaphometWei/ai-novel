import { describe, expect, it } from 'vitest';
import { createAgentRun } from './agent-run';

describe('createAgentRun', () => {
  it('records prompt version and traceable context pack id', () => {
    const run = createAgentRun({
      agentName: 'Planner Agent',
      taskType: 'chapter_planning',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_v1',
      contextPackId: 'context_pack_abc'
    });

    expect(run.status).toBe('Queued');
    expect(run.promptVersionId).toBe('prompt_v1');
    expect(run.contextPackId).toBe('context_pack_abc');
    expect(run.id).toMatch(/^agent_run_[a-z0-9]+$/);
  });
});
