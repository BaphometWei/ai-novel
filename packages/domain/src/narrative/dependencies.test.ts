import { describe, expect, it } from 'vitest';
import { createDependencyIndexEntry, invalidateDependenciesForTarget } from './dependencies';

describe('Narrative Dependency Index', () => {
  it('links a story object to a dependency target with confidence and invalidation rules', () => {
    const entry = createDependencyIndexEntry({
      projectId: 'project_abc',
      sourceObject: { type: 'Chapter', id: 'chapter_abc' },
      targetObject: { type: 'CanonFact', id: 'canon_fact_abc' },
      dependencyType: 'uses_canon',
      confidence: 0.92,
      sourceRunId: 'agent_run_abc',
      invalidationRule: 'target_changed'
    });

    expect(entry.sourceObject.type).toBe('Chapter');
    expect(entry.targetObject.type).toBe('CanonFact');
    expect(entry.confidence).toBe(0.92);
  });

  it('creates invalidations for entries that depend on a changed target', () => {
    const entry = createDependencyIndexEntry({
      projectId: 'project_abc',
      sourceObject: { type: 'Chapter', id: 'chapter_abc' },
      targetObject: { type: 'CanonFact', id: 'canon_fact_abc' },
      dependencyType: 'uses_canon',
      confidence: 0.92,
      sourceRunId: 'agent_run_abc',
      invalidationRule: 'target_changed'
    });

    const invalidations = invalidateDependenciesForTarget([entry], { type: 'CanonFact', id: 'canon_fact_abc' });

    expect(invalidations).toEqual([
      {
        dependencyId: entry.id,
        reason: 'Target CanonFact:canon_fact_abc changed',
        status: 'Pending'
      }
    ]);
  });
});
