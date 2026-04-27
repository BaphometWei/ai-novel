export type PublishIssueSeverity = 'Low' | 'Medium' | 'High' | 'Blocking';

export interface PublishIssue {
  category: 'reader_promise' | 'reveal' | 'source_policy' | 'update_calendar' | 'other';
  severity: PublishIssueSeverity;
  message: string;
}

export interface PlatformProfile {
  id: string;
  name: string;
  targetCadence: 'daily' | 'weekday' | 'weekly' | 'custom';
  chapterLengthRange: {
    min: number;
    max: number;
  };
}

export interface UpdateScheduleSlot {
  weekday: number;
  localTime: string;
}

export interface UpdateSchedule {
  timezone: string;
  slots: UpdateScheduleSlot[];
  bufferTargetChapters: number;
  currentBufferChapters: number;
  bufferGap: number;
}

export interface SerializationExperiment {
  id: string;
  name: string;
  metric: string;
  status: 'Planned' | 'Running' | 'Completed';
}

export interface SerializationPlan {
  id: string;
  projectId: string;
  platformProfile: PlatformProfile;
  updateSchedule: UpdateSchedule;
  experiments: SerializationExperiment[];
}

export type ReaderSegment = 'new_reader' | 'core_reader' | 'returning_reader' | 'drive_by';
export type ReaderSentiment = 'Positive' | 'Neutral' | 'Negative';

export interface ReaderFeedback {
  id: string;
  chapterId: string;
  segment: ReaderSegment;
  sentiment: ReaderSentiment;
  tags: string[];
  text: string;
}

export interface ReaderFeedbackSummary {
  longTermPlanId: string;
  sentimentCounts: Record<ReaderSentiment, number>;
  segmentCounts: Record<ReaderSegment, number>;
  topTags: Array<{ tag: string; count: number }>;
  feedbackCount: number;
  overridesLongTermPlan: boolean;
}

export interface ReaderFeedbackAdvisorySignal {
  tag: string;
  count: number;
  affectedSegments: ReaderSegment[];
  suggestedUse: string;
}

export interface ReaderFeedbackImportResult {
  summary: ReaderFeedbackSummary;
  advisorySignals: ReaderFeedbackAdvisorySignal[];
}

const readinessBlockerCategories = new Set<PublishIssue['category']>([
  'reader_promise',
  'reveal',
  'source_policy',
  'update_calendar'
]);

export function buildPublishChecklist(input: { chapterId: string; issues: PublishIssue[] }) {
  const blockingIssues = input.issues.filter(
    (issue) =>
      readinessBlockerCategories.has(issue.category) && (issue.severity === 'High' || issue.severity === 'Blocking')
  );
  return {
    chapterId: input.chapterId,
    ready: blockingIssues.length === 0,
    blockingIssues,
    warnings: input.issues.filter((issue) => !blockingIssues.includes(issue)),
    issues: input.issues
  };
}

export function createSerializationPlan(input: {
  projectId: string;
  platformProfile: PlatformProfile;
  updateSchedule: Omit<UpdateSchedule, 'bufferGap'>;
  experiments?: SerializationExperiment[];
}): SerializationPlan {
  return {
    id: `serialization_plan_${crypto.randomUUID().replace(/-/g, '')}`,
    projectId: input.projectId,
    platformProfile: input.platformProfile,
    updateSchedule: {
      ...input.updateSchedule,
      bufferGap: Math.max(0, input.updateSchedule.bufferTargetChapters - input.updateSchedule.currentBufferChapters)
    },
    experiments: input.experiments ?? []
  };
}

export function summarizeReaderFeedback(input: {
  longTermPlanId: string;
  feedback: ReaderFeedback[];
}): ReaderFeedbackSummary {
  const sentimentCounts: Record<ReaderSentiment, number> = {
    Positive: 0,
    Neutral: 0,
    Negative: 0
  };
  const segmentCounts: Record<ReaderSegment, number> = {
    new_reader: 0,
    core_reader: 0,
    returning_reader: 0,
    drive_by: 0
  };
  const tagCounts = new Map<string, number>();

  for (const feedback of input.feedback) {
    sentimentCounts[feedback.sentiment] += 1;
    segmentCounts[feedback.segment] += 1;
    for (const tag of feedback.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    longTermPlanId: input.longTermPlanId,
    sentimentCounts,
    segmentCounts,
    topTags: Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag)),
    feedbackCount: input.feedback.length,
    overridesLongTermPlan: false
  };
}

export function importReaderFeedbackSignals(input: {
  longTermPlanId: string;
  feedback: ReaderFeedback[];
}): ReaderFeedbackImportResult {
  const summary = summarizeReaderFeedback(input);
  const segmentsByTag = new Map<string, Set<ReaderSegment>>();

  for (const feedback of input.feedback) {
    for (const tag of feedback.tags) {
      const segments = segmentsByTag.get(tag) ?? new Set<ReaderSegment>();
      segments.add(feedback.segment);
      segmentsByTag.set(tag, segments);
    }
  }

  return {
    summary,
    advisorySignals: summary.topTags.map((tag) => ({
      tag: tag.tag,
      count: tag.count,
      affectedSegments: Array.from(segmentsByTag.get(tag.tag) ?? []).sort(),
      suggestedUse: 'Use as advisory serialization input; do not overwrite the long-term plan.'
    }))
  };
}
