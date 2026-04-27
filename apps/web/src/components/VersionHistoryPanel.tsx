import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type VersionHistoryApiClient,
  type VersionHistoryInput,
  type VersionHistorySnapshot
} from '../api/client';

const defaultProjectId = 'project_1';

function createDefaultSnapshotInput(): VersionHistoryInput {
  return {
    createdAt: new Date().toISOString(),
    entities: [
      { id: 'chapter_1', type: 'manuscript', version: 3, label: 'Chapter 1 v3' },
      { id: 'canon_1', type: 'canon', version: 1, label: 'Canon Fact v1' }
    ],
    links: [{ from: 'canon_1', to: 'chapter_1', relation: 'grounds' }]
  };
}

export interface VersionHistoryPanelProps {
  client?: VersionHistoryApiClient;
  projectId?: string;
}

export function VersionHistoryPanel({ client, projectId = defaultProjectId }: VersionHistoryPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [snapshots, setSnapshots] = useState<VersionHistorySnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<VersionHistorySnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'creating' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadSnapshots() {
      try {
        const items = await resolvedClient.listVersionHistorySnapshots(projectId);
        if (!isMounted) return;
        setSnapshots(items);
        setSelectedSnapshot(items[0] ?? null);
        setStatus('loaded');
      } catch (error) {
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : 'Unable to load version history');
        setStatus('error');
      }
    }

    void loadSnapshots();

    return () => {
      isMounted = false;
    };
  }, [projectId, resolvedClient]);

  async function createSnapshot() {
    setStatus('creating');
    try {
      const created = await resolvedClient.createVersionHistorySnapshot(projectId, createDefaultSnapshotInput());
      setSnapshots((current) => [created, ...current.filter((snapshot) => snapshot.id !== created.id)]);
      setSelectedSnapshot(created);
      setStatus('loaded');
      setMessage('Snapshot created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create snapshot');
      setStatus('error');
    }
  }

  return (
    <section className="dashboard-panel" aria-labelledby="version-history-heading">
      <header className="workspace-header">
        <p>Traceability</p>
        <h2 id="version-history-heading">Version History</h2>
      </header>

      <section className="work-surface" aria-label="Version history controls">
        <button type="button" onClick={() => void createSnapshot()} disabled={status === 'creating'}>
          {status === 'creating' ? 'Creating...' : 'Create snapshot'}
        </button>
        {status === 'loading' ? <p>Loading version history...</p> : null}
        {message ? <p>{message}</p> : null}
      </section>

      <div className="panel-grid">
        <section className="work-surface" aria-label="Version history snapshots">
          <h3>Snapshots</h3>
          {snapshots.length === 0 && status !== 'loading' ? <p>No snapshots yet.</p> : null}
          <ul>
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <button type="button" onClick={() => setSelectedSnapshot(snapshot)}>
                  {snapshot.id}
                </button>
                <span>{snapshot.createdAt}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="work-surface" aria-label="Version history detail">
          <h3>Trace Links</h3>
          {selectedSnapshot ? (
            <>
              <ul>
                {selectedSnapshot.history.trace.links.map((link) => (
                  <li key={`${link.from}-${link.to}-${link.relation}`}>
                    {link.from} -&gt; {link.to}: {link.relation}
                  </li>
                ))}
              </ul>
              <h3>Restore Points</h3>
              <ul>
                {selectedSnapshot.history.restorePoints.map((restorePoint) => (
                  <li key={`${restorePoint.entityId}-${restorePoint.version}`}>
                    {restorePoint.entityId} v{restorePoint.version}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Select a snapshot to inspect trace links and restore points.</p>
          )}
        </section>
      </div>
    </section>
  );
}
