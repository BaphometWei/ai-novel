import { describe, expect, it } from 'vitest';
import {
  canTransitionMemoryStatus,
  createArtifactRecord,
  createAgentRun,
  createContextPack,
  createFixedClock,
  createId,
  createProject,
  createVolume,
  defineProviderAdapter
} from '.';

describe('domain public exports', () => {
  it('exports Phase 1 domain factories and contracts', () => {
    expect(createId('project')).toMatch(/^project_[a-z0-9]+$/);
    expect(canTransitionMemoryStatus('Candidate', 'Draft')).toBe(true);
    expect(createFixedClock('2026-04-27T00:00:00.000Z').now()).toBe('2026-04-27T00:00:00.000Z');
    expect(createProject).toBeTypeOf('function');
    expect(createVolume).toBeTypeOf('function');
    expect(createArtifactRecord).toBeTypeOf('function');
    expect(createAgentRun).toBeTypeOf('function');
    expect(createContextPack).toBeTypeOf('function');
    expect(defineProviderAdapter).toBeTypeOf('function');
  });
});
