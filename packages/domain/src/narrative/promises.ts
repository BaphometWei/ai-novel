export type ReaderPromiseLevel = 'Micro' | 'Chapter' | 'Volume' | 'MainPlot' | 'Endgame';
export type ReaderPromiseStrength = 'Minor' | 'Major' | 'Core' | 'Low' | 'Medium' | 'High';
export type ReaderPromiseStatus =
  | 'Candidate'
  | 'Active'
  | 'PayingOff'
  | 'Fulfilled'
  | 'Abandoned'
  | 'PaidOff'
  | 'Conflict'
  | 'Dropped'
  | 'Delayed';
export type ReaderPromiseHealth = 'Normal' | 'ReadyForPayoff';
export type ReaderPromiseUiState =
  | 'PendingConfirmation'
  | 'Active'
  | 'ReadyForPayoff'
  | 'Resolved'
  | 'Problem'
  | 'Parked';

export interface NarrativeEntityRef {
  type: string;
  id: string;
}

export interface ChapterLocation {
  chapterId: string;
  chapterNumber: number;
}

export interface PayoffWindow {
  startChapter: number;
  endChapter: number;
}

export type ReaderPromiseEvidenceSignal = 'Foreshadowing' | 'Question' | 'Expectation' | 'Payoff' | 'Complication';

export interface ReaderPromiseEvidence {
  chapterId: string;
  chapterNumber: number;
  excerpt: string;
  signal?: ReaderPromiseEvidenceSignal;
}

export interface ReaderPromise {
  id: string;
  projectId: string;
  title: string;
  level: ReaderPromiseLevel;
  strength: ReaderPromiseStrength;
  surfaceClue: string;
  hiddenQuestion: string;
  readerExpectation: string;
  firstAppearance: ChapterLocation;
  relatedEntities: NarrativeEntityRef[];
  evidence: ReaderPromiseEvidence[];
  payoffWindow: PayoffWindow;
  sourceRunId: string;
  detectionConfidence: number;
  status: ReaderPromiseStatus;
  health: ReaderPromiseHealth;
}

export function createReaderPromiseFromDetection(
  input: Omit<ReaderPromise, 'id' | 'status' | 'health' | 'evidence'> & { evidence?: ReaderPromiseEvidence[] }
) {
  const promise: ReaderPromise = {
    id: `reader_promise_${crypto.randomUUID().replace(/-/g, '')}`,
    ...input,
    evidence: input.evidence ?? [],
    status: 'Candidate',
    health: 'Normal'
  };

  if (input.strength === 'Core' && input.detectionConfidence >= 0.85) {
    return {
      promise,
      approvalSignal: {
        targetType: 'ReaderPromise',
        targetId: promise.id,
        riskLevel: 'High',
        status: 'Pending'
      },
      decisionQueueEntry: {
        targetType: 'ReaderPromise',
        targetId: promise.id,
        reason: `Core reader promise detected from agent run ${input.sourceRunId}`,
        riskLevel: 'High'
      }
    };
  }

  return { promise };
}

export function assessReaderPromiseHealth(
  promise: ReaderPromise,
  input: { currentChapter: number; relatedEntitiesInScene: readonly NarrativeEntityRef[] }
): { health: ReaderPromiseHealth } {
  const inWindow =
    input.currentChapter >= promise.payoffWindow.startChapter &&
    input.currentChapter <= promise.payoffWindow.endChapter;
  const hasRelatedEntity = input.relatedEntitiesInScene.some((sceneEntity) =>
    promise.relatedEntities.some(
      (promiseEntity) => promiseEntity.type === sceneEntity.type && promiseEntity.id === sceneEntity.id
    )
  );

  return { health: promise.status === 'Active' && inWindow && hasRelatedEntity ? 'ReadyForPayoff' : 'Normal' };
}

export function getReaderPromiseUiState(promise: Pick<ReaderPromise, 'status' | 'health'>): ReaderPromiseUiState {
  if (promise.status === 'Candidate') return 'PendingConfirmation';
  if (promise.status === 'PayingOff') return 'ReadyForPayoff';
  if (promise.status === 'PaidOff' || promise.status === 'Fulfilled') return 'Resolved';
  if (promise.status === 'Conflict' || promise.status === 'Dropped' || promise.status === 'Abandoned') return 'Problem';
  if (promise.status === 'Delayed') return 'Parked';
  if (promise.health === 'ReadyForPayoff') return 'ReadyForPayoff';
  return 'Active';
}

export type ReaderPromiseUserAction =
  | 'confirm'
  | 'not-a-promise'
  | 'merge'
  | 'raise-importance'
  | 'lower-importance'
  | 'long-range'
  | 'pay-off-now'
  | 'remind-later'
  | 'park'
  | 'abandon';

export type ReaderPromiseActionInput =
  | { action: Exclude<ReaderPromiseUserAction, 'merge'> }
  | { action: 'merge'; duplicate: ReaderPromise };

export function applyReaderPromiseAction(
  promise: ReaderPromise,
  input: ReaderPromiseActionInput
): ReaderPromise {
  switch (input.action) {
    case 'confirm':
      return { ...promise, status: 'Active', health: 'Normal' };
    case 'not-a-promise':
      return { ...promise, status: 'Dropped', health: 'Normal' };
    case 'raise-importance':
      return { ...promise, level: raisePromiseLevel(promise.level) };
    case 'lower-importance':
      return { ...promise, level: lowerPromiseLevel(promise.level) };
    case 'long-range':
      return {
        ...promise,
        level: 'Endgame',
        status: 'Delayed',
        payoffWindow: {
          startChapter: promise.payoffWindow.startChapter,
          endChapter: Math.max(promise.payoffWindow.endChapter, promise.payoffWindow.startChapter + 8)
        }
      };
    case 'pay-off-now':
      return { ...promise, status: 'PayingOff', health: 'ReadyForPayoff' };
    case 'remind-later':
    case 'park':
      return { ...promise, status: 'Delayed', health: 'Normal' };
    case 'abandon':
      return { ...promise, status: 'Abandoned', health: 'Normal' };
    case 'merge':
      return mergeReaderPromises(promise, input.duplicate);
  }
}

function mergeReaderPromises(primary: ReaderPromise, duplicate: ReaderPromise): ReaderPromise {
  const stronger = getPromiseStrengthRank(duplicate.strength) > getPromiseStrengthRank(primary.strength) ? duplicate : primary;

  return {
    ...primary,
    title: stronger.title,
    level: getPromiseLevelRank(duplicate.level) > getPromiseLevelRank(primary.level) ? duplicate.level : primary.level,
    strength: stronger.strength,
    surfaceClue: stronger.surfaceClue,
    hiddenQuestion: stronger.hiddenQuestion,
    readerExpectation: stronger.readerExpectation,
    relatedEntities: uniqueEntities([...primary.relatedEntities, ...duplicate.relatedEntities]),
    evidence: [...primary.evidence, ...duplicate.evidence],
    payoffWindow: {
      startChapter: Math.min(primary.payoffWindow.startChapter, duplicate.payoffWindow.startChapter),
      endChapter: Math.max(primary.payoffWindow.endChapter, duplicate.payoffWindow.endChapter)
    },
    detectionConfidence: Math.max(primary.detectionConfidence, duplicate.detectionConfidence)
  };
}

function uniqueEntities(entities: NarrativeEntityRef[]) {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function raisePromiseLevel(level: ReaderPromiseLevel): ReaderPromiseLevel {
  const levels: ReaderPromiseLevel[] = ['Micro', 'Chapter', 'Volume', 'MainPlot', 'Endgame'];
  return levels[Math.min(levels.indexOf(level) + 1, levels.length - 1)];
}

function lowerPromiseLevel(level: ReaderPromiseLevel): ReaderPromiseLevel {
  const levels: ReaderPromiseLevel[] = ['Micro', 'Chapter', 'Volume', 'MainPlot', 'Endgame'];
  return levels[Math.max(levels.indexOf(level) - 1, 0)];
}

function getPromiseLevelRank(level: ReaderPromiseLevel) {
  return ['Micro', 'Chapter', 'Volume', 'MainPlot', 'Endgame'].indexOf(level);
}

function getPromiseStrengthRank(strength: ReaderPromiseStrength) {
  return ['Minor', 'Low', 'Medium', 'Major', 'High', 'Core'].indexOf(strength);
}

export type ReaderPromisePayoffAction = 'reinforce' | 'payoff' | 'transform' | 'delay' | 'abandon';

export function recommendReaderPromisePayoff(
  promise: ReaderPromise,
  input: {
    currentChapter: number;
    relatedEntitiesInScene: readonly NarrativeEntityRef[];
    evidence?: ReaderPromiseEvidence[];
  }
): { action: ReaderPromisePayoffAction; reason: string } {
  const inWindow =
    input.currentChapter >= promise.payoffWindow.startChapter &&
    input.currentChapter <= promise.payoffWindow.endChapter;
  const afterWindow = input.currentChapter > promise.payoffWindow.endChapter;
  const overdueBy = input.currentChapter - promise.payoffWindow.endChapter;
  const hasRelatedEntity = input.relatedEntitiesInScene.some((sceneEntity) =>
    promise.relatedEntities.some(
      (promiseEntity) => promiseEntity.type === sceneEntity.type && promiseEntity.id === sceneEntity.id
    )
  );
  const hasEvidence = (input.evidence?.length ?? 0) > 0;

  if (!inWindow && !afterWindow) {
    return { action: 'reinforce', reason: 'Promise is before its payoff window; keep expectation warm.' };
  }

  if (inWindow && hasRelatedEntity && hasEvidence) {
    return { action: 'payoff', reason: 'Promise is in its payoff window with matching entity evidence.' };
  }

  if (inWindow) {
    return { action: 'transform', reason: 'Promise is due, but current scene evidence points away from a direct payoff.' };
  }

  if (overdueBy <= 3 && (hasRelatedEntity || hasEvidence)) {
    return { action: 'delay', reason: 'Promise is just past its payoff window but still has live story evidence.' };
  }

  return { action: 'abandon', reason: 'Promise is past its payoff window without supporting scene evidence.' };
}
