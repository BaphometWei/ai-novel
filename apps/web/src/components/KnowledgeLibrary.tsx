import { useState } from 'react';
import {
  buildGenerationSourceContext,
  canUseSourceFor,
  createKnowledgeItem,
  createSourcePolicy,
  type KnowledgeItem,
  type SourceUse
} from '@ai-novel/domain';

const ownedPolicy = createSourcePolicy({
  sourceType: 'user_note',
  allowedUse: ['generation_support'],
  prohibitedUse: [],
  attributionRequirements: 'none',
  licenseNotes: 'owned',
  similarityRisk: 'Low'
});

const restrictedPolicy = createSourcePolicy({
  sourceType: 'web_excerpt',
  allowedUse: ['analysis'],
  prohibitedUse: ['generation_support'],
  attributionRequirements: 'cite source',
  licenseNotes: 'unknown',
  similarityRisk: 'High'
});

const knowledgeItems = [
  createKnowledgeItem({
    title: 'Owned setting note',
    kind: 'WorldTemplate',
    lifecycleStatus: 'Active',
    material: {
      sourceTitle: 'Author note',
      sourcePolicy: ownedPolicy,
      extractedSummary: 'A floating archive city.'
    },
    tags: ['world']
  }),
  createKnowledgeItem({
    title: 'Sample fight cadence',
    kind: 'Sample',
    lifecycleStatus: 'Active',
    material: {
      sourceTitle: 'Web excerpt',
      sourcePolicy: restrictedPolicy,
      extractedSummary: 'A clipped fight cadence sample.'
    },
    tags: ['style']
  })
];

function formatUses(uses: SourceUse[]): string {
  return uses.length > 0 ? uses.join(', ') : 'none';
}

function getSourceStatus(item: KnowledgeItem, exclusionReason?: string): string {
  if (exclusionReason) {
    return item.kind === 'Sample' && canUseSourceFor(item.material.sourcePolicy, 'analysis')
      ? 'Analysis-only sample'
      : 'Excluded from generation context';
  }

  return 'Included in generation context';
}

export function KnowledgeLibrary() {
  const [sourceCheckCurrent, setSourceCheckCurrent] = useState(false);
  const generationContext = buildGenerationSourceContext(knowledgeItems);
  const exclusionReasons = new Map(
    generationContext.exclusions.map((item) => [item.knowledgeItemId, item.reason] as const)
  );

  return (
    <section className="surface-panel" aria-labelledby="knowledge-title">
      <header className="panel-header">
        <h2 id="knowledge-title">Knowledge Library</h2>
        <span>Source Policy</span>
      </header>
      <dl className="compact-list">
        <div>
          <dt>Active material</dt>
          <dd>Samples, techniques, genre rules, and style profiles stay source-aware.</dd>
        </div>
        <div>
          <dt>Excluded from generation</dt>
          <dd>Restricted samples remain analysis-only.</dd>
        </div>
      </dl>
      <div className="knowledge-list">
        {knowledgeItems.map((item) => {
          const policy = item.material.sourcePolicy;
          const exclusionReason = exclusionReasons.get(item.id);
          return (
            <article className="knowledge-item" aria-label={item.title} key={item.id}>
              <header>
                <div>
                  <h3>{item.title}</h3>
                  <span>{item.kind}</span>
                </div>
                <strong>{getSourceStatus(item, exclusionReason)}</strong>
              </header>
              <p>{item.material.extractedSummary}</p>
              <dl className="policy-grid">
                <div>
                  <dt>Source</dt>
                  <dd>Source: {policy.sourceType}</dd>
                </div>
                <div>
                  <dt>Allowed</dt>
                  <dd>Allowed: {formatUses(policy.allowedUse)}</dd>
                </div>
                <div>
                  <dt>Prohibited</dt>
                  <dd>Prohibited: {formatUses(policy.prohibitedUse)}</dd>
                </div>
                <div>
                  <dt>Attribution</dt>
                  <dd>Attribution: {policy.attributionRequirements}</dd>
                </div>
                <div>
                  <dt>License</dt>
                  <dd>License: {policy.licenseNotes}</dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd>Similarity risk: {policy.similarityRisk}</dd>
                </div>
              </dl>
              {exclusionReason ? (
                <p>
                  <span>Excluded: {item.title}</span>
                  <span>Reason: {exclusionReason}</span>
                </p>
              ) : (
                <p>Included: {item.title}</p>
              )}
            </article>
          );
        })}
      </div>
      <div className="button-row">
        <button type="button" onClick={() => setSourceCheckCurrent(true)}>
          Run Source Check
        </button>
      </div>
      {sourceCheckCurrent ? <p>Source check current</p> : null}
    </section>
  );
}
