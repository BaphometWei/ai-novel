import { describe, expect, it } from 'vitest';
import { buildPublishChecklist, createSerializationPlan, importReaderFeedbackSignals, summarizeReaderFeedback } from './serialization';

describe('Publish checklist', () => {
  it('blocks publishing on high-risk promise reveal source-policy and calendar issues', () => {
    const checklist = buildPublishChecklist({
      chapterId: 'chapter_10',
      issues: [
        { category: 'reader_promise', severity: 'High', message: 'Core promise is near payoff and unresolved.' },
        { category: 'reveal', severity: 'High', message: 'Secret reveal timing would spoil the mystery.' },
        { category: 'source_policy', severity: 'Blocking', message: 'Restricted sample appears in draft.' },
        { category: 'update_calendar', severity: 'High', message: 'Buffer is below cadence target.' }
      ]
    });

    expect(checklist.ready).toBe(false);
    expect(checklist.blockingIssues.map((issue) => issue.category)).toEqual([
      'reader_promise',
      'reveal',
      'source_policy',
      'update_calendar'
    ]);
  });

  it('keeps non-critical high-risk issues as warnings instead of readiness blockers', () => {
    const checklist = buildPublishChecklist({
      chapterId: 'chapter_11',
      issues: [
        { category: 'other', severity: 'High', message: 'Marketing copy needs one more pass.' },
        { category: 'reader_promise', severity: 'Medium', message: 'Promise can wait one more chapter.' }
      ]
    });

    expect(checklist.ready).toBe(true);
    expect(checklist.blockingIssues).toEqual([]);
    expect(checklist.warnings.map((issue) => issue.category)).toEqual(['other', 'reader_promise']);
  });

  it('creates serialization plans with update schedule and platform profile', () => {
    const plan = createSerializationPlan({
      projectId: 'project_1',
      platformProfile: {
        id: 'platform_qidian',
        name: 'Qidian',
        targetCadence: 'daily',
        chapterLengthRange: { min: 2200, max: 3200 }
      },
      updateSchedule: {
        timezone: 'Asia/Shanghai',
        slots: [{ weekday: 1, localTime: '20:00' }],
        bufferTargetChapters: 7,
        currentBufferChapters: 3
      },
      experiments: [{ id: 'experiment_hook', name: 'Opening hook', metric: 'chapter_retention', status: 'Running' }]
    });

    expect(plan.updateSchedule.bufferGap).toBe(4);
    expect(plan.platformProfile.targetCadence).toBe('daily');
    expect(plan.experiments[0]?.status).toBe('Running');
  });

  it('summarizes reader feedback without overriding the long-term plan', () => {
    const summary = summarizeReaderFeedback({
      longTermPlanId: 'plan_main',
      feedback: [
        { id: 'feedback_1', chapterId: 'chapter_1', segment: 'new_reader', sentiment: 'Positive', tags: ['hook'], text: 'Strong hook' },
        { id: 'feedback_2', chapterId: 'chapter_2', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' },
        { id: 'feedback_3', chapterId: 'chapter_2', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Needs payoff' }
      ]
    });

    expect(summary.longTermPlanId).toBe('plan_main');
    expect(summary.sentimentCounts.Negative).toBe(2);
    expect(summary.topTags[0]).toEqual({ tag: 'pacing', count: 2 });
    expect(summary.segmentCounts.core_reader).toBe(2);
    expect(summary.overridesLongTermPlan).toBe(false);
  });

  it('imports reader feedback as advisory signals without changing the long-term plan', () => {
    const imported = importReaderFeedbackSignals({
      longTermPlanId: 'plan_main',
      feedback: [
        { id: 'feedback_1', chapterId: 'chapter_3', segment: 'returning_reader', sentiment: 'Negative', tags: ['recap_gap'], text: 'I forgot this faction.' },
        { id: 'feedback_2', chapterId: 'chapter_3', segment: 'new_reader', sentiment: 'Neutral', tags: ['recap_gap'], text: 'Needed a clearer reminder.' }
      ]
    });

    expect(imported.summary.overridesLongTermPlan).toBe(false);
    expect(imported.advisorySignals).toEqual([
      {
        tag: 'recap_gap',
        count: 2,
        affectedSegments: ['new_reader', 'returning_reader'],
        suggestedUse: 'Use as advisory serialization input; do not overwrite the long-term plan.'
      }
    ]);
  });
});
