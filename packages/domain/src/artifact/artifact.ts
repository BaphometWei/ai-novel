import { systemClock } from '../shared/clock';
import { createId, type EntityId } from '../shared/ids';

export type ArtifactType = 'manuscript_version' | 'context_pack' | 'agent_output' | 'review_report' | 'import_raw';
export type ArtifactSource = 'user' | 'agent_run' | 'import' | 'system';

export interface ArtifactRecord {
  id: EntityId<'artifact'>;
  type: ArtifactType;
  source: ArtifactSource;
  version: number;
  hash: string;
  uri: string;
  relatedRunId?: EntityId<'agent_run'>;
  createdAt: string;
}

export function createArtifactRecord(input: Omit<ArtifactRecord, 'id' | 'createdAt'>): ArtifactRecord {
  return {
    id: createId('artifact'),
    createdAt: systemClock.now(),
    ...input
  };
}
