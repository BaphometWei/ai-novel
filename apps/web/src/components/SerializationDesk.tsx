import { useMemo, useState } from 'react';
import {
  buildPublishChecklist,
  createSerializationPlan,
  summarizeReaderFeedback,
  type PublishIssue,
  type ReaderFeedback
} from '@ai-novel/domain';

const baseFeedback: ReaderFeedback[] = [
  {
    id: 'feedback_hook_1',
    chapterId: 'chapter_1',
    segment: 'new_reader',
    sentiment: 'Positive',
    tags: ['hook'],
    text: 'Strong hook'
  },
  {
    id: 'feedback_pacing_1',
    chapterId: 'chapter_2',
    segment: 'core_reader',
    sentiment: 'Negative',
    tags: ['pacing'],
    text: 'Pacing slows before the payoff.'
  },
  {
    id: 'feedback_pacing_2',
    chapterId: 'chapter_2',
    segment: 'core_reader',
    sentiment: 'Negative',
    tags: ['pacing'],
    text: 'Needs a sharper turn.'
  }
];

const publishIssues: PublishIssue[] = [
  { category: 'reader_promise', severity: 'High', message: 'Core promise is near payoff and unresolved.' },
  { category: 'reveal', severity: 'High', message: 'Secret reveal timing would spoil the bell mystery.' },
  { category: 'source_policy', severity: 'Blocking', message: 'Restricted sample appears in draft.' },
  { category: 'update_calendar', severity: 'High', message: 'Buffer is below the daily cadence target.' }
];

export function SerializationDesk() {
  const [bufferChapters, setBufferChapters] = useState(3);
  const [feedback, setFeedback] = useState(baseFeedback);
  const plan = useMemo(
    () =>
      createSerializationPlan({
        projectId: 'project_demo',
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
          currentBufferChapters: bufferChapters
        }
      }),
    [bufferChapters]
  );
  const publishChecklist = useMemo(
    () => buildPublishChecklist({ chapterId: 'chapter_12', issues: publishIssues }),
    []
  );
  const feedbackSummary = useMemo(
    () => summarizeReaderFeedback({ longTermPlanId: plan.id, feedback }),
    [feedback, plan.id]
  );
  const pacingCount = feedback.filter((item) => item.tags.includes('pacing')).length;
  const hookPraiseCount = feedback.filter((item) => item.sentiment === 'Positive' && item.tags.includes('hook')).length;

  return (
    <section className="surface-panel" aria-labelledby="serialization-title">
      <header className="panel-header">
        <h2 id="serialization-title">Serialization Desk</h2>
        <span>Local</span>
      </header>
      <dl className="compact-list">
        <div>
          <dt>Publish readiness</dt>
          <dd>
            {publishChecklist.ready
              ? 'No blocking issues'
              : `Blocked by ${publishChecklist.blockingIssues.length} issues`}
          </dd>
        </div>
        <div>
          <dt>Update buffer</dt>
          <dd>{plan.updateSchedule.currentBufferChapters} of {plan.updateSchedule.bufferTargetChapters} target chapters</dd>
        </div>
        <div>
          <dt>Update calendar</dt>
          <dd>Daily {plan.updateSchedule.slots[0]?.localTime} {plan.updateSchedule.timezone}</dd>
        </div>
        <div>
          <dt>Reader feedback</dt>
          <dd>{pacingCount} pacing notes, {hookPraiseCount} hook praise</dd>
        </div>
        <div>
          <dt>Feedback summary</dt>
          <dd>{feedbackSummary.feedbackCount} imported, plan preserved</dd>
        </div>
        <div>
          <dt>Buffer gap</dt>
          <dd>Buffer gap: {plan.updateSchedule.bufferGap}</dd>
        </div>
      </dl>
      <ul className="blocking-list" aria-label="Publish blockers">
        {publishChecklist.blockingIssues.map((issue) => (
          <li key={`${issue.category}-${issue.message}`}>
            {formatIssueCategory(issue.category)}: {issue.message}
          </li>
        ))}
      </ul>
      <div className="button-row">
        <button
          type="button"
          onClick={() =>
            setFeedback((items) => [
              ...items,
              {
                id: `feedback_pacing_${items.length + 1}`,
                chapterId: 'chapter_3',
                segment: 'core_reader',
                sentiment: 'Negative',
                tags: ['pacing'],
                text: 'Imported reader note flags a slow bridge scene.'
              }
            ])
          }
        >
          Import Feedback
        </button>
        <button type="button" onClick={() => setBufferChapters((count) => count + 1)}>
          Add Buffer Chapter
        </button>
      </div>
    </section>
  );
}

function formatIssueCategory(category: PublishIssue['category']): string {
  const labels: Record<PublishIssue['category'], string> = {
    reader_promise: 'Reader promise',
    reveal: 'Reveal',
    source_policy: 'Source policy',
    update_calendar: 'Update calendar',
    other: 'Other'
  };
  return labels[category];
}
