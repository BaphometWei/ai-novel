import { createId, type EntityId } from '../shared/ids';
import { canTransitionMemoryStatus, type MemoryStatus } from '../shared/status';
import { systemClock } from '../shared/clock';

export type SourceType = 'user_note' | 'manuscript' | 'agent_summary' | 'import' | 'system';

export interface SourceReference {
  sourceType: SourceType;
  sourceId: string;
  citation: string;
}

export interface ConfirmationRecord {
  actor: 'user' | 'system' | 'agent';
  reason: string;
  confirmedAt: string;
}

export interface CanonLedgerEntry {
  fromStatus: MemoryStatus;
  toStatus: MemoryStatus;
  actor: 'user' | 'system' | 'agent';
  reason: string;
  createdAt: string;
}

export interface CanonFact {
  id: EntityId<'canon_fact'>;
  projectId: EntityId<'project'>;
  text: string;
  status: MemoryStatus;
  sourceReferences: SourceReference[];
  confirmationTrail: ConfirmationRecord[];
  ledger: CanonLedgerEntry[];
  createdAt: string;
  updatedAt: string;
}

export function createCanonFact(input: {
  projectId: EntityId<'project'>;
  text: string;
  status: MemoryStatus;
  sourceReferences: SourceReference[];
  confirmationTrail: ConfirmationRecord[];
}): CanonFact {
  if (input.status === 'Canon' && input.sourceReferences.length === 0) {
    throw new Error('Canon facts require at least one source reference');
  }

  if (input.status === 'Canon' && input.confirmationTrail.length === 0) {
    throw new Error('Canon facts require at least one confirmation record');
  }

  const now = systemClock.now();
  return {
    id: createId('canon_fact'),
    projectId: input.projectId,
    text: input.text,
    status: input.status,
    sourceReferences: input.sourceReferences,
    confirmationTrail: input.confirmationTrail,
    ledger: [],
    createdAt: now,
    updatedAt: now
  };
}

export function transitionCanonFactStatus(
  fact: CanonFact,
  toStatus: MemoryStatus,
  input: { actor: 'user' | 'system' | 'agent'; reason: string }
): CanonFact {
  if (!canTransitionMemoryStatus(fact.status, toStatus)) {
    throw new Error(`Invalid memory status transition: ${fact.status} -> ${toStatus}`);
  }

  const now = systemClock.now();
  const confirmationTrail =
    toStatus === 'Canon'
      ? [...fact.confirmationTrail, { actor: input.actor, reason: input.reason, confirmedAt: now }]
      : fact.confirmationTrail;

  return {
    ...fact,
    status: toStatus,
    confirmationTrail,
    ledger: [
      ...fact.ledger,
      {
        fromStatus: fact.status,
        toStatus,
        actor: input.actor,
        reason: input.reason,
        createdAt: now
      }
    ],
    updatedAt: now
  };
}
