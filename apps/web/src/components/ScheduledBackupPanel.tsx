import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type ScheduledBackupApiClient,
  type ScheduledBackupDueResult,
  type ScheduledBackupPolicy,
  type ScheduledBackupRunInput
} from '../api/client';

export interface ScheduledBackupPanelProps {
  client?: ScheduledBackupApiClient;
  now?: string;
}

export function ScheduledBackupPanel({ client, now = '2026-04-27T12:00:00.000Z' }: ScheduledBackupPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [policies, setPolicies] = useState<ScheduledBackupPolicy[]>([]);
  const [due, setDue] = useState<ScheduledBackupDueResult | null>(null);
  const [runResult, setRunResult] = useState<ScheduledBackupPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [policyList, dueResult] = await Promise.all([
          resolvedClient.listScheduledBackupPolicies(),
          resolvedClient.listDueScheduledBackups(now)
        ]);
        if (!cancelled) {
          setPolicies(policyList);
          setDue(dueResult);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load scheduled backups');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [now, resolvedClient]);

  async function recordRun(status: ScheduledBackupRunInput['status']) {
    const policyId = due?.policies[0]?.id ?? policies[0]?.id;
    if (!policyId) return;

    setRunning(true);
    setError(null);
    try {
      setRunResult(await resolvedClient.recordScheduledBackupRun(policyId, { completedAt: now, status }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record scheduled backup run');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="surface-panel" aria-labelledby="scheduled-backups-title">
      <header className="panel-header">
        <h2 id="scheduled-backups-title">Scheduled Backups</h2>
        <span>{now}</span>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p>Loading scheduled backups...</p> : null}

      <div className="panel-grid">
        <section className="work-surface" aria-label="Scheduled backup policies">
          <h3>Policies</h3>
          <dl className="compact-list">
            {policies.map((policy) => (
              <div key={policy.id}>
                <dt>{policy.id}</dt>
                <dd>
                  <span>{policy.cadence}</span>
                  <span>{policy.targetPathPrefix}</span>
                  <span>{policy.lastRunStatus ?? 'No runs'}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="work-surface" aria-label="Due backup intents">
          <h3>Due Intents</h3>
          <dl className="compact-list">
            {(due?.intents ?? []).map((intent) => (
              <div key={intent.id}>
                <dt>{intent.id}</dt>
                <dd>
                  <span>{intent.projectId}</span>
                  <span>{intent.targetPathPrefix}</span>
                </dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={() => void recordRun('Succeeded')} disabled={running}>
            Mark success
          </button>
          <button type="button" onClick={() => void recordRun('Failed')} disabled={running}>
            Mark failure
          </button>
        </section>
      </div>

      {runResult ? (
        <section className="work-surface" aria-label="Scheduled backup run result">
          <p>Run {runResult.lastRunStatus}</p>
          <p>{runResult.nextRunAt}</p>
        </section>
      ) : null}
    </section>
  );
}
