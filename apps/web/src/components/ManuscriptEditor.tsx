const chapters = [
  { id: 'chapter_11', title: 'Chapter 11: Lower Gate', status: 'Reviewed' },
  { id: 'chapter_12', title: 'Chapter 12: Siege Bell', status: 'Drafting' },
  { id: 'chapter_13', title: 'Chapter 13: Archive Flame', status: 'Planned' }
];

export function ManuscriptEditor() {
  return (
    <section className="editor-panel" id="manuscript" aria-labelledby="manuscript-editor-title">
      <header className="panel-header">
        <h2 id="manuscript-editor-title">Manuscript Editor</h2>
        <span>Drafting</span>
      </header>
      <div className="manuscript-layout">
        <aside className="chapter-tree" aria-label="Chapter tree" role="tree">
          {chapters.map((chapter) => (
            <button
              aria-label={chapter.title}
              aria-selected={chapter.id === 'chapter_12'}
              className="chapter-node"
              key={chapter.id}
              role="treeitem"
              type="button"
            >
              <span>{chapter.title}</span>
              <small>{chapter.status}</small>
            </button>
          ))}
        </aside>
        <article className="draft-surface">
          <div
            aria-label="Scene draft editor"
            className="draft-editor"
            contentEditable
            role="textbox"
            suppressContentEditableWarning
          >
            The siege bell sounded under the archive city.
          </div>
          <dl className="compact-list context-inspector">
            <div>
              <dt>Context inspector</dt>
              <dd>Canon: archive city remains airborne</dd>
            </div>
            <div>
              <dt>Reader promise</dt>
              <dd>Sealed bell mystery is ready for payoff</dd>
            </div>
            <div>
              <dt>Risk gate</dt>
              <dd>Medium risk, author review required before canon change</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}
