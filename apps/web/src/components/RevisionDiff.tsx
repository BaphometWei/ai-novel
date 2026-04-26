import type { RevisionSuggestionStatus } from '@ai-novel/domain';

export interface RevisionDiffSuggestion {
  title: string;
  rationale: string;
  before: string;
  after: string;
  risk: 'Low' | 'Medium' | 'High';
  status: RevisionSuggestionStatus;
}

export function RevisionDiff({ suggestion }: { suggestion: RevisionDiffSuggestion }) {
  return (
    <article className="revision-diff" aria-labelledby="revision-diff-title">
      <header className="panel-header">
        <h3 id="revision-diff-title">Revision Diff</h3>
        <span>Risk: {suggestion.risk}</span>
      </header>
      <p>{suggestion.title}</p>
      <p>{suggestion.rationale}</p>
      <div className="diff-grid">
        <section aria-label="Before revision">
          <h4>Before</h4>
          <p>{suggestion.before}</p>
        </section>
        <section aria-label="After revision">
          <h4>After</h4>
          <p>{suggestion.after}</p>
        </section>
      </div>
      <p>Revision status: {suggestion.status}</p>
    </article>
  );
}
