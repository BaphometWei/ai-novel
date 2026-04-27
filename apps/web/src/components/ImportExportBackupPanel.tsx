import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createApiClient,
  type BackupApiClient,
  type BackupWorkflowResult,
  type ImportExportApiClient,
  type RestoreBackupResult,
} from '../api/client';

export interface ImportExportBackupPanelProps {
  client?: BackupApiClient & Partial<ImportExportApiClient>;
  projectId?: string;
}

type ImportMode = 'merge' | 'replace';

interface ImportJobResult {
  job?: {
    id?: string;
    status?: string;
    projectId?: string;
    payload?: {
      sourceUri?: string;
      mode?: ImportMode;
    };
  };
}

export function ImportExportBackupPanel({ client, projectId }: ImportExportBackupPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const initialProjectId = projectId ?? '';
  const projectIdEditedRef = useRef(false);
  const projectIdFocusedRef = useRef(false);
  const [projectIdInput, setProjectIdInput] = useState(initialProjectId);
  const [reason, setReason] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [backupPath, setBackupPath] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [importSourceUri, setImportSourceUri] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [createResult, setCreateResult] = useState<BackupWorkflowResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<BackupWorkflowResult | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreBackupResult | null>(null);
  const [importResult, setImportResult] = useState<ImportJobResult | null>(null);
  const [exportResult, setExportResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const hasProject = projectIdInput.trim().length > 0;

  useEffect(() => {
    if (!projectIdEditedRef.current && !projectIdFocusedRef.current) setProjectIdInput(projectId ?? '');
  }, [projectId]);

  function updateProjectIdInput(value: string) {
    projectIdEditedRef.current = value !== (projectId ?? '');
    setProjectIdInput(value);
  }

  async function createBackup() {
    if (!hasProject) return;
    setError(null);
    try {
      const result = await resolvedClient.createProjectBackup(projectIdInput, { reason, requestedBy });
      setCreateResult(result);
      if (result.record?.path) setBackupPath(result.record.path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create backup');
    }
  }

  async function importBundle() {
    if (!hasProject) return;
    setError(null);
    try {
      if (!('enqueueImportJob' in resolvedClient)) throw new Error('Import/export API unavailable');
      setImportResult(
        (await (resolvedClient as ImportExportApiClient).enqueueImportJob({
          projectId: projectIdInput,
          sourceUri: importSourceUri,
          mode: importMode
        })) as ImportJobResult
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import bundle');
    }
  }

  async function exportBundle() {
    if (!hasProject) return;
    setError(null);
    try {
      if (!('enqueueExportBundle' in resolvedClient)) throw new Error('Import/export API unavailable');
      setExportResult(await (resolvedClient as ImportExportApiClient).enqueueExportBundle({ projectId: projectIdInput, includeArtifacts: true }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to export bundle');
    }
  }

  async function verifyBackup() {
    setError(null);
    try {
      setVerifyResult(await resolvedClient.verifyBackup(backupPath));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to verify backup');
    }
  }

  async function restoreBackup() {
    setError(null);
    try {
      setRestoreResult(await resolvedClient.restoreBackup({ path: backupPath, targetProjectId, requestedBy }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to restore backup');
    }
  }

  return (
    <section className="surface-panel" aria-labelledby="backup-panel-title">
      <header className="workspace-header">
        <p>Import / Export / Backup</p>
        <h2 id="backup-panel-title">Portable Bundle Desk</h2>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {!hasProject ? <p>No project available.</p> : null}

      <section className="work-surface" aria-label="Backup controls">
        <label>
          Project id
          <input
            value={projectIdInput}
            onFocus={() => {
              projectIdFocusedRef.current = true;
            }}
            onBlur={() => {
              projectIdFocusedRef.current = false;
              if (!projectIdEditedRef.current) setProjectIdInput(projectId ?? '');
            }}
            onChange={(event) => updateProjectIdInput(event.target.value)}
          />
        </label>
        <label>
          Reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label>
          Requested by
          <input value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} />
        </label>
        <button type="button" onClick={() => void createBackup()} disabled={!hasProject}>
          Create backup
        </button>
      </section>

      {createResult ? (
        <section className="work-surface" aria-label="Backup create result">
          <BackupResult result={createResult} />
        </section>
      ) : null}

      <section className="work-surface" aria-label="Import export controls">
        <label>
          Import source URI
          <input value={importSourceUri} onChange={(event) => setImportSourceUri(event.target.value)} />
        </label>
        <label>
          Import mode
          <select value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
            <option value="merge">merge</option>
            <option value="replace">replace</option>
          </select>
        </label>
        <button type="button" onClick={() => void importBundle()} disabled={!hasProject}>
          Import bundle
        </button>
        <button type="button" onClick={() => void exportBundle()} disabled={!hasProject}>
          Export bundle
        </button>
      </section>

      {importResult ? (
        <section className="work-surface" aria-label="Import job result">
          <ImportResult result={importResult} />
        </section>
      ) : null}

      {exportResult ? (
        <section className="work-surface" aria-label="Export bundle result">
          <pre>{JSON.stringify(exportResult, null, 2)}</pre>
        </section>
      ) : null}

      <section className="work-surface" aria-label="Verify controls">
        <label>
          Backup path
          <input value={backupPath} onChange={(event) => setBackupPath(event.target.value)} />
        </label>
        <button type="button" onClick={() => void verifyBackup()}>
          Verify backup
        </button>
      </section>

      {verifyResult ? (
        <section className="work-surface" aria-label="Backup verify result">
          <BackupResult result={verifyResult} />
        </section>
      ) : null}

      <section className="work-surface" aria-label="Restore controls">
        <label>
          Target project id
          <input value={targetProjectId} onChange={(event) => setTargetProjectId(event.target.value)} />
        </label>
        <button type="button" onClick={() => void restoreBackup()}>
          Restore backup
        </button>
      </section>

      {restoreResult ? (
        <section className="work-surface" aria-label="Backup restore result">
          <RestoreResult result={restoreResult} />
        </section>
      ) : null}
    </section>
  );
}

function ImportResult({ result }: { result: ImportJobResult }) {
  return (
    <>
      <p>{result.job?.id}</p>
      <p>{result.job?.status}</p>
      <p>{result.job?.projectId}</p>
      <p>{result.job?.payload?.sourceUri}</p>
      <p>{result.job?.payload?.mode}</p>
    </>
  );
}

function BackupResult({ result }: { result: BackupWorkflowResult }) {
  return (
    <>
      <p>{result.job.id}</p>
      <p>{result.job.status}</p>
      <p>{result.status.stage}</p>
      {result.status.error ? <p>{result.status.error}</p> : null}
      {result.record ? (
        <>
          <p>{result.record.path}</p>
          <p>{result.record.hash}</p>
        </>
      ) : null}
    </>
  );
}

function RestoreResult({ result }: { result: RestoreBackupResult }) {
  return (
    <>
      <p>{result.job.id}</p>
      <p>{result.job.status}</p>
      <p>{result.status.stage}</p>
      {result.record?.rollbackActions.map((action) => (
        <p key={`${action.type}:${action.targetId}`}>
          {action.type} {action.targetId}
        </p>
      ))}
    </>
  );
}
