import {
  createReaderPromiseFromDetection,
  type NarrativeEntityRef,
  type PayoffWindow,
  type ReaderPromise,
  type ReaderPromiseEvidence,
  type ReaderPromiseLevel,
  type ReaderPromiseStrength
} from './promises';

export type PromiseConfidenceTier = 'silent_pool' | 'summary' | 'confirmation_list' | 'decision_queue';

export interface PromiseSignalNote {
  title: string;
  surfaceClue: string;
  hiddenQuestion: string;
  readerExpectation: string;
  relatedEntities: NarrativeEntityRef[];
  importance: 'Minor' | 'Major' | 'Core';
  payoffWindow: PayoffWindow;
  confidence: number;
}

export interface PromiseExtractionSceneNotes {
  chapterId: string;
  chapterNumber: number;
  promiseSignals?: PromiseSignalNote[];
}

export interface ExtractedPromiseCandidate extends ReaderPromise {
  confidenceTier: PromiseConfidenceTier;
}

export function extractPromiseCandidatesFromStructuredText(input: {
  projectId: string;
  sourceRunId: string;
  acceptedText: string;
  sceneNotes: PromiseExtractionSceneNotes;
}) {
  const candidates = (input.sceneNotes.promiseSignals ?? []).map((signal) => {
    const evidence: ReaderPromiseEvidence = {
      chapterId: input.sceneNotes.chapterId,
      chapterNumber: input.sceneNotes.chapterNumber,
      excerpt: signal.surfaceClue,
      signal: signal.importance === 'Core' ? 'Foreshadowing' : 'Expectation'
    };
    const { promise } = createReaderPromiseFromDetection({
      projectId: input.projectId,
      title: signal.title,
      level: toPromiseLevel(signal.importance),
      strength: toPromiseStrength(signal.importance),
      surfaceClue: signal.surfaceClue,
      hiddenQuestion: signal.hiddenQuestion,
      readerExpectation: signal.readerExpectation,
      firstAppearance: {
        chapterId: input.sceneNotes.chapterId,
        chapterNumber: input.sceneNotes.chapterNumber
      },
      relatedEntities: signal.relatedEntities,
      evidence: [evidence],
      payoffWindow: signal.payoffWindow,
      sourceRunId: input.sourceRunId,
      detectionConfidence: signal.confidence
    });

    return {
      ...promise,
      confidenceTier: getConfidenceTier(signal)
    };
  });

  return {
    candidates,
    silentPool: candidates.filter((candidate) => candidate.confidenceTier === 'silent_pool'),
    summary: candidates.filter((candidate) => candidate.confidenceTier === 'summary'),
    confirmationList: candidates.filter((candidate) => candidate.confidenceTier === 'confirmation_list'),
    decisionQueue: candidates.filter((candidate) => candidate.confidenceTier === 'decision_queue')
  };
}

function getConfidenceTier(signal: PromiseSignalNote): PromiseConfidenceTier {
  if (signal.importance === 'Core' && signal.confidence >= 0.9) return 'decision_queue';
  if (signal.confidence >= 0.75) return 'confirmation_list';
  if (signal.confidence >= 0.55) return 'summary';
  return 'silent_pool';
}

function toPromiseLevel(importance: PromiseSignalNote['importance']): ReaderPromiseLevel {
  if (importance === 'Core') return 'MainPlot';
  if (importance === 'Major') return 'Volume';
  return 'Chapter';
}

function toPromiseStrength(importance: PromiseSignalNote['importance']): ReaderPromiseStrength {
  if (importance === 'Core') return 'Core';
  if (importance === 'Major') return 'Major';
  return 'Minor';
}
