import { describe, expect, it } from 'vitest';
import { diffNarrativeState, restoreVersion } from './semantic-diff';

describe('semantic narrative diff', () => {
  it('diffs narrative state semantically and restores a prior version with traceability', () => {
    const before = {
      id: 'narrative_state_before',
      canon: [{ id: 'canon_bell', text: 'The bell sleeps.' }],
      promises: [{ id: 'promise_bell', payoffChapter: 20 }],
      secrets: [{ id: 'secret_bell', revealChapter: 18 }]
    };
    const after = {
      id: 'narrative_state_after',
      canon: [{ id: 'canon_bell', text: 'The bell is alive.' }],
      promises: [{ id: 'promise_bell', payoffChapter: 24 }],
      secrets: [{ id: 'secret_bell', revealChapter: 22 }]
    };

    const diff = diffNarrativeState(before, after);
    const restored = restoreVersion(after, diff.restorePoint);

    expect(diff.changes.map((change) => change.type)).toEqual([
      'CanonChanged',
      'PromisePayoffMoved',
      'SecretRevealDelayed'
    ]);
    expect(restored).toMatchObject({
      id: 'narrative_state_before',
      traceability: { parentVersionId: 'narrative_state_after', restoredFromVersionId: 'narrative_state_before' }
    });
  });
});
