import { useState } from 'react';
import { buildGenerationSourceContext, createKnowledgeItem, createSourcePolicy } from '@ai-novel/domain';

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

export function KnowledgeLibrary() {
  const [sourceCheckCurrent, setSourceCheckCurrent] = useState(false);
  const generationContext = buildGenerationSourceContext(knowledgeItems);
  const excludedIds = new Set(generationContext.exclusions.map((item) => item.knowledgeItemId));
  const excludedItems = knowledgeItems.filter((item) => excludedIds.has(item.id));

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
      <ul className="compact-list">
        {generationContext.included.map((item) => (
          <li key={item.id}>Included: {item.title}</li>
        ))}
        {excludedItems.map((item) => {
          const exclusion = generationContext.exclusions.find((entry) => entry.knowledgeItemId === item.id);
          return (
            <li key={item.id}>
              <span>Excluded: {item.title}</span>
              <span>Reason: {exclusion?.reason}</span>
            </li>
          );
        })}
      </ul>
      <div className="button-row">
        <button type="button" onClick={() => setSourceCheckCurrent(true)}>
          Run Source Check
        </button>
      </div>
      {sourceCheckCurrent ? <p>Source check current</p> : null}
    </section>
  );
}
