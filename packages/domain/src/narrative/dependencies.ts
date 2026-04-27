import { createId, type EntityId } from '../shared/ids';

export interface NarrativeObjectRef {
  type: string;
  id: string;
}

export type DependencyInvalidationRule = 'target_changed' | 'source_rewritten' | 'manual_recheck';
export type DependencyInvalidationStatus = 'Pending' | 'Resolved';

export interface DependencyIndexEntry {
  id: EntityId<'dependency'>;
  projectId: EntityId<'project'>;
  sourceObject: NarrativeObjectRef;
  targetObject: NarrativeObjectRef;
  dependencyType: string;
  confidence: number;
  sourceRunId: EntityId<'agent_run'> | 'user_action';
  invalidationRule: DependencyInvalidationRule;
}

export interface DependencyInvalidation {
  dependencyId: EntityId<'dependency'>;
  reason: string;
  status: DependencyInvalidationStatus;
}

export function createDependencyIndexEntry(input: Omit<DependencyIndexEntry, 'id'>): DependencyIndexEntry {
  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error('Dependency confidence must be between 0 and 1');
  }

  return {
    id: createId('dependency'),
    ...input
  };
}

export function invalidateDependenciesForTarget(
  entries: DependencyIndexEntry[],
  target: NarrativeObjectRef
): DependencyInvalidation[] {
  return entries
    .filter((entry) => entry.targetObject.type === target.type && entry.targetObject.id === target.id)
    .map((entry) => ({
      dependencyId: entry.id,
      reason: `Target ${target.type}:${target.id} changed`,
      status: 'Pending'
    }));
}
