export type MemoryStatus = 'Candidate' | 'Draft' | 'Canon' | 'Deprecated' | 'Conflict';

const allowedTransitions: ReadonlySet<string> = new Set([
  'Candidate->Draft',
  'Draft->Canon',
  'Canon->Deprecated',
  'Canon->Conflict',
  'Conflict->Canon',
  'Conflict->Deprecated',
  'Conflict->Draft'
]);

export function canTransitionMemoryStatus(from: MemoryStatus, to: MemoryStatus): boolean {
  return allowedTransitions.has(`${from}->${to}`);
}
