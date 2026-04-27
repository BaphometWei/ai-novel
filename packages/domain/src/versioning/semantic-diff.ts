export type SemanticChangeType = 'CanonChanged' | 'PromisePayoffMoved' | 'SecretRevealDelayed' | 'SecretRevealMovedEarlier';

export interface NarrativeCanonFactSnapshot {
  id: string;
  text: string;
}

export interface NarrativePromiseSnapshot {
  id: string;
  payoffChapter: number;
}

export interface NarrativeSecretSnapshot {
  id: string;
  revealChapter: number;
}

export interface NarrativeStateSnapshot {
  id: string;
  canon: NarrativeCanonFactSnapshot[];
  promises: NarrativePromiseSnapshot[];
  secrets: NarrativeSecretSnapshot[];
  traceability?: {
    parentVersionId?: string;
    restoredFromVersionId?: string;
  };
}

export interface SemanticChange {
  type: SemanticChangeType;
  entityId: string;
  before: unknown;
  after: unknown;
}

export interface SemanticDiff {
  fromVersionId: string;
  toVersionId: string;
  changes: SemanticChange[];
  restorePoint: NarrativeStateSnapshot;
}

export function diffNarrativeState(before: NarrativeStateSnapshot, after: NarrativeStateSnapshot): SemanticDiff {
  return {
    fromVersionId: before.id,
    toVersionId: after.id,
    changes: [
      ...diffCanon(before.canon, after.canon),
      ...diffPromises(before.promises, after.promises),
      ...diffSecrets(before.secrets, after.secrets)
    ],
    restorePoint: cloneSnapshot(before)
  };
}

export function restoreVersion(current: NarrativeStateSnapshot, restorePoint: NarrativeStateSnapshot): NarrativeStateSnapshot {
  return {
    ...cloneSnapshot(restorePoint),
    traceability: {
      parentVersionId: current.id,
      restoredFromVersionId: restorePoint.id
    }
  };
}

function diffCanon(before: NarrativeCanonFactSnapshot[], after: NarrativeCanonFactSnapshot[]): SemanticChange[] {
  const afterById = new Map(after.map((fact) => [fact.id, fact]));
  return before.flatMap((fact) => {
    const next = afterById.get(fact.id);
    if (!next || next.text === fact.text) return [];
    return [{ type: 'CanonChanged' as const, entityId: fact.id, before: fact.text, after: next.text }];
  });
}

function diffPromises(before: NarrativePromiseSnapshot[], after: NarrativePromiseSnapshot[]): SemanticChange[] {
  const afterById = new Map(after.map((promise) => [promise.id, promise]));
  return before.flatMap((promise) => {
    const next = afterById.get(promise.id);
    if (!next || next.payoffChapter === promise.payoffChapter) return [];
    return [
      {
        type: 'PromisePayoffMoved' as const,
        entityId: promise.id,
        before: promise.payoffChapter,
        after: next.payoffChapter
      }
    ];
  });
}

function diffSecrets(before: NarrativeSecretSnapshot[], after: NarrativeSecretSnapshot[]): SemanticChange[] {
  const afterById = new Map(after.map((secret) => [secret.id, secret]));
  return before.flatMap((secret) => {
    const next = afterById.get(secret.id);
    if (!next || next.revealChapter === secret.revealChapter) return [];
    return [
      {
        type: next.revealChapter > secret.revealChapter ? 'SecretRevealDelayed' : 'SecretRevealMovedEarlier',
        entityId: secret.id,
        before: secret.revealChapter,
        after: next.revealChapter
      }
    ];
  });
}

function cloneSnapshot(snapshot: NarrativeStateSnapshot): NarrativeStateSnapshot {
  return {
    ...snapshot,
    canon: snapshot.canon.map((fact) => ({ ...fact })),
    promises: snapshot.promises.map((promise) => ({ ...promise })),
    secrets: snapshot.secrets.map((secret) => ({ ...secret })),
    traceability: snapshot.traceability ? { ...snapshot.traceability } : undefined
  };
}
