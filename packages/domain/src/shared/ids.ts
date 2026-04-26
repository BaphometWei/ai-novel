export type EntityPrefix =
  | 'project'
  | 'volume'
  | 'chapter'
  | 'scene'
  | 'artifact'
  | 'agent_run'
  | 'context_pack'
  | 'canon_fact'
  | 'approval_request'
  | 'dependency'
  | 'foreshadowing'
  | 'reader_promise';

export type EntityId<TPrefix extends EntityPrefix = EntityPrefix> = `${TPrefix}_${string}`;

export function createId<TPrefix extends EntityPrefix>(prefix: TPrefix): EntityId<TPrefix> {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}` as EntityId<TPrefix>;
}
