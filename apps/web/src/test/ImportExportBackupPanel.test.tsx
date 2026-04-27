import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApiClient,
  type BackupApiClient,
  type BackupWorkflowResult,
  type ImportExportApiClient,
  type RestoreBackupResult
} from '../api/client';
import { ImportExportBackupPanel } from '../components/ImportExportBackupPanel';

describe('ImportExportBackupPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('creates, verifies, and restores backups while showing job, hash, path, status, and rollback info', async () => {
    render(<ImportExportBackupPanel client={mockBackupClient()} />);

    fireEvent.change(screen.getByLabelText('Project id'), { target: { value: 'project_1' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'manual' } });
    fireEvent.change(screen.getByLabelText('Requested by'), { target: { value: 'operator' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create backup' }));

    const createResult = await screen.findByLabelText('Backup create result');
    expect(within(createResult).getByText('backup_job_1')).toBeInTheDocument();
    expect(within(createResult).getByText('memory://backup_1.json')).toBeInTheDocument();
    expect(within(createResult).getByText('hash_backup')).toBeInTheDocument();
    expect(within(createResult).getByText('created')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Backup path'), { target: { value: 'memory://backup_1.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify backup' }));

    const verifyResult = await screen.findByLabelText('Backup verify result');
    expect(within(verifyResult).getByText('verify_job_1')).toBeInTheDocument();
    expect(within(verifyResult).getByText('verified')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Target project id'), { target: { value: 'project_restored' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }));

    const restoreResult = await screen.findByLabelText('Backup restore result');
    expect(within(restoreResult).getByText('restore_job_1')).toBeInTheDocument();
    expect(within(restoreResult).getByText('restored')).toBeInTheDocument();
    expect(within(restoreResult).getByText('delete_project project_restored')).toBeInTheDocument();
  });

  it('shows failed verification status and error text from the API response', async () => {
    render(<ImportExportBackupPanel client={mockBackupClient({ rejectVerify: true })} />);

    fireEvent.change(screen.getByLabelText('Backup path'), { target: { value: 'memory://tampered.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify backup' }));

    const verifyResult = await screen.findByLabelText('Backup verify result');
    expect(within(verifyResult).getByText('Failed')).toBeInTheDocument();
    expect(within(verifyResult).getByText('verify-rejected')).toBeInTheDocument();
    expect(within(verifyResult).getByText('Backup hash mismatch')).toBeInTheDocument();
  });

  it('exports bundles through import-export API when available', async () => {
    render(<ImportExportBackupPanel client={mockImportExportClient()} />);

    fireEvent.change(screen.getByLabelText('Project id'), { target: { value: 'project_1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export bundle' }));

    const result = await screen.findByLabelText('Export bundle result');
    expect(within(result).getByText(/export_job_1/)).toBeInTheDocument();
    expect(within(result).getByText(/memory:\/\/project_1\/export.zip/)).toBeInTheDocument();
  });

  it('enqueues an import job with source URI and mode then shows job details', async () => {
    const client = mockImportExportClient();
    render(<ImportExportBackupPanel client={client} />);

    fireEvent.change(screen.getByLabelText('Project id'), { target: { value: 'project_1' } });
    fireEvent.change(screen.getByLabelText('Import source URI'), { target: { value: 'memory://bundle.zip' } });
    fireEvent.change(screen.getByLabelText('Import mode'), { target: { value: 'replace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import bundle' }));

    const result = await screen.findByLabelText('Import job result');
    expect(within(result).getByText('import_job_1')).toBeInTheDocument();
    expect(within(result).getByText('Queued')).toBeInTheDocument();
    expect(within(result).getByText('memory://bundle.zip')).toBeInTheDocument();
    expect(within(result).getByText('replace')).toBeInTheDocument();
  });
});

describe('backup API client helpers', () => {
  afterEach(() => {
    cleanup();
  });

  it('creates, verifies, and restores backups through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/projects/project_1/backups') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ reason: 'manual', requestedBy: 'operator' });
        return jsonResponse(createBackupResult, true, 201);
      }
      if (path === '/api/backups/verify') {
        expect(JSON.parse(String(init?.body))).toEqual({ path: 'memory://backup_1.json' });
        return jsonResponse(verifyBackupResult);
      }
      if (path === '/api/backups/restore') {
        expect(JSON.parse(String(init?.body))).toEqual({
          path: 'memory://backup_1.json',
          targetProjectId: 'project_restored',
          requestedBy: 'operator'
        });
        return jsonResponse(restoreBackupResult);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    const created = await client.createProjectBackup('project_1', { reason: 'manual', requestedBy: 'operator' });
    const verified = await client.verifyBackup('memory://backup_1.json');
    const restored = await client.restoreBackup({
      path: 'memory://backup_1.json',
      targetProjectId: 'project_restored',
      requestedBy: 'operator'
    });

    expect(created.record).toMatchObject({ path: 'memory://backup_1.json' });
    expect(verified.status).toEqual({ ok: true, stage: 'verified', hash: 'hash_backup' });
    expect(restored.record?.rollbackActions).toEqual([{ type: 'delete_project', targetId: 'project_restored' }]);
  });

  it('calls import-export endpoints through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/exports/bundles') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ projectId: 'project_1', includeArtifacts: true });
        return jsonResponse(exportBundleResult, true, 202);
      }
      if (path === '/api/exports/bundles/export_bundle_1') return jsonResponse(exportBundleResult.bundle);
      if (path === '/api/imports/jobs') {
        expect(JSON.parse(String(init?.body))).toEqual({ projectId: 'project_1', sourceUri: 'memory://bundle.zip', mode: 'merge' });
        return jsonResponse({ job: { id: 'import_job_1' } }, true, 202);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.enqueueExportBundle({ projectId: 'project_1', includeArtifacts: true })).resolves.toEqual(exportBundleResult);
    await expect(client.getExportBundle('export_bundle_1')).resolves.toEqual(exportBundleResult.bundle);
    await expect(client.enqueueImportJob({ projectId: 'project_1', sourceUri: 'memory://bundle.zip', mode: 'merge' })).resolves.toEqual({ job: { id: 'import_job_1' } });
  });
});

function mockBackupClient(options: { rejectVerify?: boolean } = {}): BackupApiClient {
  return {
    createProjectBackup: async () => createBackupResult,
    verifyBackup: async () =>
      options.rejectVerify
        ? {
            ...verifyBackupResult,
            job: { ...verifyBackupResult.job, status: 'Failed', error: 'Backup hash mismatch' },
            status: { ok: false, stage: 'verify-rejected', error: 'Backup hash mismatch' }
          }
        : verifyBackupResult,
    restoreBackup: async () => restoreBackupResult
  };
}

function mockImportExportClient(): BackupApiClient & ImportExportApiClient {
  return {
    ...mockBackupClient(),
    enqueueImportJob: async () => importJobResult,
    enqueueExportBundle: async () => exportBundleResult,
    getExportBundle: async () => exportBundleResult.bundle
  };
}

const importJobResult = {
  job: {
    id: 'import_job_1',
    type: 'import.project',
    status: 'Queued',
    projectId: 'project_1',
    payload: { sourceUri: 'memory://bundle.zip', mode: 'replace' }
  }
};

const exportBundleResult = {
  job: {
    id: 'export_job_1',
    type: 'export.bundle',
    status: 'Queued',
    projectId: 'project_1',
    payload: { includeArtifacts: true }
  },
  bundle: {
    id: 'export_bundle_1',
    projectId: 'project_1',
    status: 'Queued',
    uri: 'memory://project_1/export.zip'
  }
};

const createBackupResult: BackupWorkflowResult = {
  job: {
    id: 'backup_job_1',
    type: 'backup.create',
    status: 'Succeeded',
    projectId: 'project_1',
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:00:00.000Z',
    output: { backupId: 'backup_1', hash: 'hash_backup' }
  },
  record: {
    id: 'backup_1',
    projectId: 'project_1',
    path: 'memory://backup_1.json',
    hash: 'hash_backup',
    manifest: {
      backupId: 'backup_1',
      projectId: 'project_1',
      schemaVersion: 1,
      createdAt: '2026-04-27T10:00:00.000Z',
      reason: 'manual',
      requestedBy: 'operator',
      contentHash: 'hash_content'
    },
    createdAt: '2026-04-27T10:00:00.000Z',
    byteLength: 128
  },
  status: { ok: true, stage: 'created', hash: 'hash_backup' }
};

const verifyBackupResult: BackupWorkflowResult = {
  ...createBackupResult,
  job: {
    ...createBackupResult.job,
    id: 'verify_job_1',
    type: 'backup.verify',
    output: { backupId: 'backup_1', hash: 'hash_backup' }
  },
  status: { ok: true, stage: 'verified', hash: 'hash_backup' }
};

const restoreBackupResult: RestoreBackupResult = {
  job: {
    id: 'restore_job_1',
    type: 'backup.restore',
    status: 'Succeeded',
    projectId: 'project_restored',
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:00:00.000Z',
    output: { restoreId: 'restore_1', sourceBackupId: 'backup_1', hash: 'hash_backup' }
  },
  record: {
    id: 'restore_1',
    backupId: 'backup_1',
    sourceProjectId: 'project_1',
    targetProjectId: 'project_restored',
    hash: 'hash_backup',
    requestedBy: 'operator',
    restoredAt: '2026-04-27T10:00:00.000Z',
    rollbackActions: [{ type: 'delete_project', targetId: 'project_restored' }]
  },
  status: { ok: true, stage: 'restored', hash: 'hash_backup' }
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
