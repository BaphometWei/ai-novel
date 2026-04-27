import type { ReaderSegment } from './serialization';

export type SerializationCadenceType = 'daily' | 'weekday' | 'weekly' | 'custom';
export type SerializationRiskTolerance = 'None' | 'Low' | 'Medium' | 'High';

export interface SerializationCadence {
  type: SerializationCadenceType;
  chaptersPerWeek: number;
  preferredLocalTimes: string[];
}

export interface TitleConstraint {
  maxLength: number;
  requiresKeyword: boolean;
}

export interface HookConstraint {
  maxCharacters: number;
  mustSurfaceConflict: boolean;
}

export interface RecapConstraint {
  maxCharacters: number;
  requiredForReturningReaders: boolean;
}

export interface CliffhangerConstraint {
  required: boolean;
  maxRisk: Exclude<SerializationRiskTolerance, 'None'>;
}

export interface SerializationPlatformProfile {
  id: string;
  name: string;
  cadence: SerializationCadence;
  chapterLengthRange: {
    min: number;
    max: number;
  };
  title: TitleConstraint;
  hook: HookConstraint;
  recap: RecapConstraint;
  cliffhanger: CliffhangerConstraint;
  readerSegment: ReaderSegment;
  riskTolerance: {
    readerPromise: SerializationRiskTolerance;
    reveal: SerializationRiskTolerance;
    sourcePolicy: SerializationRiskTolerance;
    updateCalendar: SerializationRiskTolerance;
  };
}

export function createPlatformProfile(input: SerializationPlatformProfile): SerializationPlatformProfile {
  return input;
}
