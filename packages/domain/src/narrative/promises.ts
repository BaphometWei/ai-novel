export type ReaderPromiseLevel = 'Micro' | 'Chapter' | 'Volume' | 'MainPlot' | 'Endgame';
export type ReaderPromiseStrength = 'Low' | 'Medium' | 'High' | 'Core';
export type ReaderPromiseStatus =
  | 'Candidate'
  | 'Active'
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
  payoffWindow: PayoffWindow;
  sourceRunId: string;
  detectionConfidence: number;
  status: ReaderPromiseStatus;
  health: ReaderPromiseHealth;
}

export function createReaderPromiseFromDetection(
  input: Omit<ReaderPromise, 'id' | 'status' | 'health'>
) {
  const promise: ReaderPromise = {
    id: `reader_promise_${crypto.randomUUID().replace(/-/g, '')}`,
    ...input,
    status: 'Candidate',
    health: 'Normal'
  };

  if (input.strength === 'Core') {
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
  input: { currentChapter: number; relatedEntitiesInScene: NarrativeEntityRef[] }
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
  if (promise.status === 'PaidOff') return 'Resolved';
  if (promise.status === 'Conflict' || promise.status === 'Dropped') return 'Problem';
  if (promise.status === 'Delayed') return 'Parked';
  if (promise.health === 'ReadyForPayoff') return 'ReadyForPayoff';
  return 'Active';
}
