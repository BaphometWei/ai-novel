import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('persistent API runtime', () => {
  it('wires DB-backed agent run stores for the server runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/agent-runs/agent_run_missing/llm-calls',
      payload: {
        promptVersionId: 'prompt_v1',
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 1, outputTokens: 1 },
        durationMs: 10,
        estimatedCostUsd: 0.000002,
        retryCount: 0,
        status: 'Succeeded'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Agent run not found' });
    runtime.database.client.close();
  });
});
