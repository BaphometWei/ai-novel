const boards = [
  ['Reader Promises', '0 active'],
  ['Secrets', '0 reveal risks'],
  ['Character Arcs', '0 blocked'],
  ['Timeline', '0 contradictions'],
  ['World Rules', '0 exceptions'],
  ['Branch Sandbox', '0 scenarios']
];

export function StoryBible() {
  return (
    <section className="panel-grid" aria-label="Story Bible">
      {boards.map(([title, status]) => (
        <article className="surface-panel" key={title}>
          <h3>{title}</h3>
          <p>{status}</p>
        </article>
      ))}
    </section>
  );
}
