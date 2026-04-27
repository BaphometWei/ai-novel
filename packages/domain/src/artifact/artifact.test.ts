import { describe, expect, it } from 'vitest';
import { createArtifactRecord } from './artifact';

describe('createArtifactRecord', () => {
  it('requires hash, type, source, version, and uri metadata', () => {
    const artifact = createArtifactRecord({
      type: 'context_pack',
      source: 'agent_run',
      version: 1,
      hash: 'sha256:abc',
      uri: 'artifacts/context-pack.json',
      relatedRunId: 'agent_run_context'
    });

    expect(artifact).toMatchObject({
      type: 'context_pack',
      source: 'agent_run',
      version: 1,
      hash: 'sha256:abc',
      uri: 'artifacts/context-pack.json',
      relatedRunId: 'agent_run_context'
    });
  });
});
