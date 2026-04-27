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
  topTags: Array<{ tag: string; count: number }>;
  feedbackCount: number;
  overridesLongTermPlan: boolean;
}

export function buildPublishChecklist(input: { chapterId: string; issues: PublishIssue[] }) {
  const blockingIssues = input.issues.filter((issue) => issue.severity === 'High' || issue.severity === 'Blocking');
  return {
    chapterId: input.chapterId,
    ready: blockingIssues.length === 0,
    blockingIssues,
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
  const tagCounts = new Map<string, number>();

  for (const feedback of input.feedback) {
    sentimentCounts[feedback.sentiment] += 1;
    for (const tag of feedback.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    longTermPlanId: input.longTermPlanId,
    sentimentCounts,
    topTags: Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag)),
    feedbackCount: input.feedback.length,
    overridesLongTermPlan: false
  };
}
