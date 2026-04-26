import { useState } from 'react';
import type { ReviewFindingStatus, RevisionSuggestionStatus } from '@ai-novel/domain';
import { RevisionDiff, type RevisionDiffSuggestion } from './RevisionDiff';

const baseSuggestion: Omit<RevisionDiffSuggestion, 'status'> = {
  title: 'Move secret use after reveal',
  rationale: 'Keeps the knowledge boundary intact.',
  before: 'Mira names the living bell before the reveal.',
  after: 'Mira hears the living bell but cannot name it yet.',
  risk: 'Medium'
};

export function ReviewCenter() {
  const [findingStatus, setFindingStatus] = useState<ReviewFindingStatus>('Open');
  const [revisionStatus, setRevisionStatus] = useState<RevisionSuggestionStatus>('Proposed');
  const [explanationRequested, setExplanationRequested] = useState(false);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);

  function decideRevision(finding: Extract<ReviewFindingStatus, 'Applied' | 'Rejected'>) {
    setFindingStatus(finding);
    setRevisionStatus(finding);
  }

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
        <RevisionDiff suggestion={{ ...baseSuggestion, status: revisionStatus }} />
        <div className="button-row">
          <button type="button" onClick={() => decideRevision('Applied')}>
            Apply
          </button>
          <button type="button" onClick={() => decideRevision('Rejected')}>
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
