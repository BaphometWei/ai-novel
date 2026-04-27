import type { ReaderFeedbackAdvisorySignal, UpdateSchedule } from './serialization';
import type { SerializationPlatformProfile } from './platform-profile';

export type SerializationRecommendationKind = 'title' | 'hook' | 'recap' | 'cliffhanger' | 'update_calendar';

export interface SerializationRecommendation {
  kind: SerializationRecommendationKind;
  suggestion: string;
  evidence: string[];
  warnings: string[];
}

export interface RecommendationChapterInput {
  id: string;
  title: string;
  synopsis: string;
  currentWordCount: number;
  unresolvedPromiseTitles: string[];
  plannedRevealTitles: string[];
}

export function buildSerializationRecommendations(input: {
  profile: SerializationPlatformProfile;
  chapter: RecommendationChapterInput;
  updateSchedule: UpdateSchedule;
  readerSignals?: Array<Omit<ReaderFeedbackAdvisorySignal, 'suggestedUse'>>;
}): SerializationRecommendation[] {
  const recapGap = input.readerSignals?.find((signal) => signal.tag === 'recap_gap');
  const payoffWait = input.readerSignals?.find((signal) => signal.tag === 'payoff_wait');
  const calendarWarning =
    input.updateSchedule.bufferGap > 0
      ? [`Buffer is ${input.updateSchedule.bufferGap} chapter(s) below target for ${input.profile.cadence.type} cadence.`]
      : [];

  return [
    {
      kind: 'title',
      suggestion: trimToLimit(input.chapter.title, input.profile.title.maxLength),
      evidence: [`Platform title limit is ${input.profile.title.maxLength} characters.`],
      warnings: input.profile.title.requiresKeyword ? ['Title should preserve a searchable story keyword.'] : []
    },
    {
      kind: 'hook',
      suggestion: trimToLimit(input.chapter.synopsis, input.profile.hook.maxCharacters),
      evidence: [`Hook limit is ${input.profile.hook.maxCharacters} characters.`],
      warnings: input.profile.hook.mustSurfaceConflict ? ['Hook should surface the central conflict.'] : []
    },
    {
      kind: 'recap',
      suggestion: `Recap before ${input.chapter.id}: ${input.chapter.synopsis}`,
      evidence: [`Target reader segment is ${input.profile.readerSegment}.`],
      warnings: recapGap ? ['Reader feedback indicates recap gaps.'] : []
    },
    {
      kind: 'cliffhanger',
      suggestion: input.chapter.unresolvedPromiseTitles[0]
        ? `Close on pressure around ${input.chapter.unresolvedPromiseTitles[0]}.`
        : 'Close on a concrete unresolved choice.',
      evidence: [`Cliffhanger required: ${input.profile.cliffhanger.required}.`],
      warnings: payoffWait ? ['Reader feedback indicates payoff impatience.'] : []
    },
    {
      kind: 'update_calendar',
      suggestion: `Keep ${input.profile.cadence.chaptersPerWeek} update(s) per week at ${input.profile.cadence.preferredLocalTimes.join(', ')} ${input.updateSchedule.timezone}.`,
      evidence: [`Current schedule has ${input.updateSchedule.slots.length} slot(s).`],
      warnings: calendarWarning
    }
  ];
}

function trimToLimit(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, Math.max(0, limit - 1)).trimEnd();
}
