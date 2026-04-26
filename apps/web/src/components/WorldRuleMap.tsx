export function WorldRuleMap() {
  return (
    <article className="surface-panel narrative-board">
      <header className="panel-header">
        <h2>World Rule Map</h2>
        <span>Rule warning</span>
      </header>
      <dl className="compact-list">
        <div>
          <dt>World Rules</dt>
          <dd>Rule: Bell magic requires a memory cost.</dd>
        </div>
        <div>
          <dt>Constraint</dt>
          <dd>Using the bell without a named memory creates a high-risk exception.</dd>
        </div>
      </dl>
    </article>
  );
}
