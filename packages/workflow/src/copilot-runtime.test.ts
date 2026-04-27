import { describe, expect, it } from 'vitest';
import { evaluateRuntimeEvent } from './copilot-runtime';

describe('Creative Copilot Runtime', () => {
  it('makes high-risk events visible even in quiet initiative mode', () => {
    const decision = evaluateRuntimeEvent(
      { initiative: 'quiet', executionDepth: 'deep', visibility: 'compact', attentionBudget: 1 },
      { type: 'canon_conflict', riskLevel: 'High', message: 'Canon conflict detected' }
    );

    expect(decision.visible).toBe(true);
    expect(decision.route).toBe('decision_queue');
  });
});
