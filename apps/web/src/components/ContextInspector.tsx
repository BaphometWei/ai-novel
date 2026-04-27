import type { AgentRoomContextPack } from '../api/client';

export interface ContextInspectorProps {
  contextPack: AgentRoomContextPack | null | undefined;
}

export function ContextInspector({ contextPack }: ContextInspectorProps) {
  if (!contextPack) {
    return <p>No context pack captured.</p>;
  }

  return (
    <div>
      <p>{contextPack.taskGoal}</p>
      {contextPack.sections.map((section) => (
        <section key={section.name} aria-label={`Context section ${section.name}`}>
          <h4>{section.name}</h4>
          <p>{section.content}</p>
        </section>
      ))}
      <List title="Context citations" items={contextPack.citations.map((citation) => citation.quote ?? citation.sourceId)} />
      <List title="Warnings" items={contextPack.warnings} />
      <List title="Exclusions" items={contextPack.exclusions} />
      <List title="Retrieval trace" items={contextPack.retrievalTrace} />
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label={title}>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
