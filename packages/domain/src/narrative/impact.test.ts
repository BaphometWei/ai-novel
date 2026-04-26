import { describe, expect, it } from 'vitest';
import { createDependencyIndexEntry } from './dependencies';
import { buildCanonChangeImpactReport } from './impact';

describe('Change impact reports', () => {
  it('returns affected chapters, promises, secrets, arcs, rules, and timeline events from canon dependencies', () => {
    const target = { type: 'CanonFact', id: 'canon_fact_origin' };
    const entries = [
      dependency('Chapter', 'chapter_1', target.id),
      dependency('ReaderPromise', 'reader_promise_1', target.id),
      dependency('Secret', 'secret_1', target.id),
      dependency('CharacterArc', 'character_arc_1', target.id),
      dependency('WorldRule', 'world_rule_1', target.id),
      dependency('TimelineEvent', 'timeline_event_1', target.id),
      dependency('Chapter', 'chapter_unrelated', 'canon_fact_elsewhere')
    ];

    const report = buildCanonChangeImpactReport(entries, target);

    expect(report.changedObject).toEqual(target);
    expect(report.affected).toEqual({
      chapters: ['chapter_1'],
      promises: ['reader_promise_1'],
      secrets: ['secret_1'],
      arcs: ['character_arc_1'],
      rules: ['world_rule_1'],
      timelineEvents: ['timeline_event_1']
    });
  });
});

function dependency(sourceType: string, sourceId: string, targetId: string) {
  return createDependencyIndexEntry({
    projectId: 'project_abc',
    sourceObject: { type: sourceType, id: sourceId },
    targetObject: { type: 'CanonFact', id: targetId },
    dependencyType: 'uses_canon',
    confidence: 0.9,
    sourceRunId: 'agent_run_abc',
    invalidationRule: 'target_changed'
  });
}
