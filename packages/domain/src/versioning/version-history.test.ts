import { describe, expect, it } from 'vitest';
import { createVersionHistory } from './version-history';

describe('createVersionHistory', () => {
  it('creates traceable versions across manuscript, canon, prompt, run, context pack, and artifact entities', () => {
    const history = createVersionHistory({
      entities: [
        { id: 'version_1', type: 'manuscript', version: 3, label: 'Chapter 12 accepted draft' },
        { id: 'canon_1', type: 'canon', version: 2, label: 'Bell is alive' },
        { id: 'prompt_writer', type: 'prompt', version: 5, label: 'writer.v2.1' },
        { id: 'run_1', type: 'run', version: 1, label: 'Writer run' },
        { id: 'context_pack_1', type: 'context_pack', version: 1, label: 'Writer context' },
        { id: 'artifact_1', type: 'artifact', version: 1, label: 'Draft artifact' }
      ],
      links: [
        { from: 'run_1', to: 'context_pack_1', relation: 'used_context' },
        { from: 'run_1', to: 'artifact_1', relation: 'created_artifact' },
        { from: 'artifact_1', to: 'version_1', relation: 'accepted_as' }
      ],
      createdAt: '2026-04-27T10:00:00.000Z'
    });

    expect(history.entities.map((entity) => entity.type)).toEqual([
      'manuscript',
      'canon',
      'prompt',
      'run',
      'context_pack',
      'artifact'
    ]);
    expect(history.trace.links).toContainEqual({ from: 'run_1', to: 'context_pack_1', relation: 'used_context' });
    expect(history.restorePoints).toEqual([{ entityId: 'version_1', version: 3 }]);
  });
});
