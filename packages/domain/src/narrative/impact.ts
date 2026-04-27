import type { DependencyIndexEntry, NarrativeObjectRef } from './dependencies';

export function buildCanonChangeImpactReport(entries: DependencyIndexEntry[], changedObject: NarrativeObjectRef) {
  const affected = {
    chapters: [] as string[],
    promises: [] as string[],
    secrets: [] as string[],
    arcs: [] as string[],
    rules: [] as string[],
    timelineEvents: [] as string[]
  };

  for (const entry of entries) {
    if (entry.targetObject.type !== changedObject.type || entry.targetObject.id !== changedObject.id) {
      continue;
    }

    if (entry.sourceObject.type === 'Chapter') affected.chapters.push(entry.sourceObject.id);
    if (entry.sourceObject.type === 'ReaderPromise') affected.promises.push(entry.sourceObject.id);
    if (entry.sourceObject.type === 'Secret') affected.secrets.push(entry.sourceObject.id);
    if (entry.sourceObject.type === 'CharacterArc') affected.arcs.push(entry.sourceObject.id);
    if (entry.sourceObject.type === 'WorldRule') affected.rules.push(entry.sourceObject.id);
    if (entry.sourceObject.type === 'TimelineEvent') affected.timelineEvents.push(entry.sourceObject.id);
  }

  return { changedObject, affected };
}
