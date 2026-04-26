import { useState } from 'react';
import type { ReviewFindingStatus } from '@ai-novel/domain';

export function ReviewCenter() {
  const [findingStatus, setFindingStatus] = useState<ReviewFindingStatus>('Open');
  const [explanationRequested, setExplanationRequested] = useState(false);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);

  return (
    <section className="surface-panel" aria-labelledby="review-center-title">
      <header className="panel-header">
        <h2 id="review-center-title">Review Center</h2>
        <span>Quality 76</span>
      </header>
      <article className="review-finding">
        <h3>Continuity finding</h3>
        <p>High risk knowledge-boundary issue in chapter 12 draft.</p>
        <dl className="compact-list">
          <div>
            <dt>Evidence</dt>
            <dd>Secret reveal occurs after the speaker uses it.</dd>
          </div>
          <div>
            <dt>Suggestion</dt>
            <dd>Move the line after reveal or change speaker.</dd>
          </div>
        </dl>
        <p>Finding status: {findingStatus}</p>
        {explanationRequested ? <p>Explanation requested from Continuity Sentinel</p> : null}
        {taskTitle ? <p>Task created: {taskTitle}</p> : null}
        <div className="button-row">
          <button type="button" onClick={() => setFindingStatus('Applied')}>
            Apply
          </button>
          <button type="button" onClick={() => setFindingStatus('Rejected')}>
            Reject
          </button>
          <button type="button" onClick={() => setExplanationRequested(true)}>
            Ask Why
          </button>
          <button type="button" onClick={() => setTaskTitle('Fix knowledge-boundary continuity issue')}>
            Convert to Task
          </button>
        </div>
      </article>
    </section>
  );
}
