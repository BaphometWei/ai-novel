export function SecretBoard() {
  return (
    <article className="surface-panel narrative-board">
      <header className="panel-header">
        <h2>Secret Board</h2>
        <span>Reveal risk</span>
      </header>
      <dl className="compact-list">
        <div>
          <dt>Secrets</dt>
          <dd>Secret: Only the archivist knows the bell is alive.</dd>
        </div>
        <div>
          <dt>Knowledge boundary</dt>
          <dd>Mira can suspect the bell, but cannot name its mind yet.</dd>
        </div>
      </dl>
    </article>
  );
}
