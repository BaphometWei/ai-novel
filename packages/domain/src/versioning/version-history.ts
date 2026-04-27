export type VersionedEntityType = 'manuscript' | 'canon' | 'prompt' | 'run' | 'context_pack' | 'artifact';

export interface VersionedEntityRef {
  id: string;
  type: VersionedEntityType;
  version: number;
  label: string;
}

export interface VersionTraceLink {
  from: string;
  to: string;
  relation: string;
}

export interface VersionRestorePoint {
  entityId: string;
  version: number;
}

export interface VersionHistoryInput {
  entities: VersionedEntityRef[];
  links: VersionTraceLink[];
  createdAt: string;
}

export interface VersionHistory {
  entities: VersionedEntityRef[];
  trace: {
    links: VersionTraceLink[];
    createdAt: string;
  };
  restorePoints: VersionRestorePoint[];
}

export function createVersionHistory(input: VersionHistoryInput): VersionHistory {
  const seen = new Set<string>();
  const entities = input.entities.filter((entity) => {
    const key = `${entity.type}:${entity.id}:${entity.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    entities,
    trace: {
      links: input.links,
      createdAt: input.createdAt
    },
    restorePoints: entities
      .filter((entity) => entity.type === 'manuscript')
      .map((entity) => ({ entityId: entity.id, version: entity.version }))
  };
}
