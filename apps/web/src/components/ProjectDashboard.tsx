const stats = [
  { label: 'Draft Chapters', value: '0' },
  { label: 'Active Promises', value: '0' },
  { label: 'Canon Conflicts', value: '0' },
  { label: 'Open Reviews', value: '0' }
];

export function ProjectDashboard() {
  return (
    <section className="dashboard-panel" aria-labelledby="current-project">
      <header className="workspace-header">
        <p>Current Project</p>
        <h2 id="current-project">Writing Cockpit</h2>
      </header>
      <div className="status-grid">
        {stats.map((stat) => (
          <article className="status-tile" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>
      <section className="work-surface" aria-label="Manuscript status">
        <h3>Manuscript</h3>
        <p>No chapters yet.</p>
      </section>
    </section>
  );
}
