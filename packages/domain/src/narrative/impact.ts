import type { DependencyIndexEntry, NarrativeObjectRef } from './dependencies';

export function buildCanonChangeImpactReport(entries: DependencyIndexEntry[], changedObject: NarrativeObjectRef) {
  const affectedSets = {
    chapters: new Set<string>(),
    promises: new Set<string>(),
    secrets: new Set<string>(),
    arcs: new Set<string>(),
    rules: new Set<string>(),
    timelineEvents: new Set<string>()
  };

  for (const entry of entries) {
    if (entry.targetObject.type !== changedObject.type || entry.targetObject.id !== changedObject.id) {
      continue;
    }

    if (entry.sourceObject.type === 'Chapter') affectedSets.chapters.add(entry.sourceObject.id);
    if (entry.sourceObject.type === 'ReaderPromise') affectedSets.promises.add(entry.sourceObject.id);
    if (entry.sourceObject.type === 'Secret') affectedSets.secrets.add(entry.sourceObject.id);
    if (entry.sourceObject.type === 'CharacterArc') affectedSets.arcs.add(entry.sourceObject.id);
    if (entry.sourceObject.type === 'WorldRule') affectedSets.rules.add(entry.sourceObject.id);
    if (entry.sourceObject.type === 'TimelineEvent') affectedSets.timelineEvents.add(entry.sourceObject.id);
  }

  return {
    changedObject,
    affected: {
      chapters: [...affectedSets.chapters],
      promises: [...affectedSets.promises],
      secrets: [...affectedSets.secrets],
      arcs: [...affectedSets.arcs],
      rules: [...affectedSets.rules],
      timelineEvents: [...affectedSets.timelineEvents]
    }
  };
}
