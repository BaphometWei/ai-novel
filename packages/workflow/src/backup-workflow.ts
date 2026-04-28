export type BackupWorkflowJobStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed';
export type BackupWorkflowJobType = 'backup.create' | 'backup.verify' | 'backup.restore';

export interface BackupWorkflowJob {
  id: string;
  type: BackupWorkflowJobType;
  status: BackupWorkflowJobStatus;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface BackupWorkflowManifest {
  backupId: string;
  projectId: string;
  schemaVersion: number;
  createdAt: string;
  reason?: string;
  requestedBy?: string;
  sections?: string[];
  contentHash: string;
}

export interface BackupRecord {
  id: string;
  projectId: string;
  path: string;
  hash: string;
  manifest: BackupWorkflowManifest;
  createdAt: string;
  byteLength: number;
}

export interface RestoreRecord {
  id: string;
  backupId: string;
  sourceProjectId: string;
  targetProjectId: string;
  hash: string;
  requestedBy?: string;
  restoredAt: string;
  rollbackActions: Array<{ type: 'delete_project'; targetId: string }>;
}

export type BackupWorkflowStatus =
  | { ok: true; stage: 'created' | 'verified' | 'restored'; hash: string }
  | { ok: false; stage: 'verify-rejected' | 'restore-rejected'; error: string };

export interface BackupWorkflowDependencies {
  clock: { now(): string };
  ids: {
    createJobId(): string;
    createBackupId(): string;
    createRestoreId(): string;
  };
  hash(value: unknown): string;
  store: {
    writeText(path: string, content: string): Promise<void> | void;
    readText(path: string): Promise<string> | string;
  };
  repository: {
    readProjectSnapshot(projectId: string): Promise<unknown> | unknown;
    backupPathFor(backupId: string): string;
    saveBackupRecord(record: BackupRecord): Promise<void> | void;
    findBackupByPath(path: string): Promise<BackupRecord | undefined> | BackupRecord | undefined;
    restoreProject(targetProjectId: string, payload: unknown): Promise<void> | void;
    saveRestoreRecord(record: RestoreRecord): Promise<void> | void;
  };
}

export interface CreateBackupInput {
  projectId: string;
  reason?: string;
  requestedBy?: string;
}

export interface VerifyBackupInput {
  path: string;
}

export interface RestoreBackupInput {
  path: string;
  targetProjectId: string;
  requestedBy?: string;
}

export async function createBackup(
  input: CreateBackupInput,
  deps: BackupWorkflowDependencies
): Promise<{ job: BackupWorkflowJob; record: BackupRecord; status: BackupWorkflowStatus }> {
  const now = deps.clock.now();
  const jobId = deps.ids.createJobId();
  const backupId = deps.ids.createBackupId();
  const payload = await deps.repository.readProjectSnapshot(input.projectId);
  const manifest: BackupWorkflowManifest = {
    backupId,
    projectId: input.projectId,
    schemaVersion: 1,
    createdAt: now,
    reason: input.reason,
    requestedBy: input.requestedBy,
    sections: inferBackupSections(payload),
    contentHash: deps.hash(payload)
  };
  const unsignedEnvelope = { manifest, payload };
  const hash = deps.hash(unsignedEnvelope);
  const envelope: BackupEnvelope = { ...unsignedEnvelope, hash };
  const content = JSON.stringify(envelope, null, 2);
  const path = deps.repository.backupPathFor(backupId);
  const record: BackupRecord = {
    id: backupId,
    projectId: input.projectId,
    path,
    hash,
    manifest,
    createdAt: now,
    byteLength: Buffer.byteLength(content, 'utf8')
  };

  await deps.store.writeText(path, content);
  await deps.repository.saveBackupRecord(record);

  return {
    job: succeededJob(jobId, 'backup.create', input.projectId, now, { backupId, hash }),
    record,
    status: { ok: true, stage: 'created', hash }
  };
}

export async function verifyBackup(
  input: VerifyBackupInput,
  deps: BackupWorkflowDependencies
): Promise<{ job: BackupWorkflowJob; record: BackupRecord; status: BackupWorkflowStatus }> {
  const now = deps.clock.now();
  const jobId = deps.ids.createJobId();

  try {
    const verified = await readVerifiedBackup(input.path, deps);
    return {
      job: {
        id: jobId,
        type: 'backup.verify',
        status: 'Succeeded',
        projectId: verified.record.projectId,
        createdAt: now,
        updatedAt: now,
        output: { backupId: verified.record.id, hash: verified.record.hash }
      },
      record: verified.record,
      status: { ok: true, stage: 'verified', hash: verified.record.hash }
    };
  } catch (error) {
    return {
      job: failedJob(jobId, 'backup.verify', now, errorMessage(error)),
      record: emptyRejectedRecord(input.path, now),
      status: { ok: false, stage: 'verify-rejected', error: errorMessage(error) }
    };
  }
}

export async function restoreBackup(
  input: RestoreBackupInput,
  deps: BackupWorkflowDependencies
): Promise<{ job: BackupWorkflowJob; record?: RestoreRecord; status: BackupWorkflowStatus }> {
  const now = deps.clock.now();
  const jobId = deps.ids.createJobId();

  try {
    const verified = await readVerifiedBackup(input.path, deps);
    const restoreRecord: RestoreRecord = {
      id: deps.ids.createRestoreId(),
      backupId: verified.record.id,
      sourceProjectId: verified.record.projectId,
      targetProjectId: input.targetProjectId,
      hash: verified.record.hash,
      requestedBy: input.requestedBy,
      restoredAt: now,
      rollbackActions: [{ type: 'delete_project', targetId: input.targetProjectId }]
    };

    await deps.repository.restoreProject(input.targetProjectId, verified.envelope.payload);
    await deps.repository.saveRestoreRecord(restoreRecord);

    return {
      job: {
        id: jobId,
        type: 'backup.restore',
        status: 'Succeeded',
        projectId: input.targetProjectId,
        createdAt: now,
        updatedAt: now,
        output: { restoreId: restoreRecord.id, sourceBackupId: restoreRecord.backupId, hash: restoreRecord.hash }
      },
      record: restoreRecord,
      status: { ok: true, stage: 'restored', hash: restoreRecord.hash }
    };
  } catch (error) {
    return {
      job: failedJob(jobId, 'backup.restore', now, errorMessage(error), input.targetProjectId),
      status: { ok: false, stage: 'restore-rejected', error: errorMessage(error) }
    };
  }
}

interface BackupEnvelope {
  manifest: BackupWorkflowManifest;
  payload: unknown;
  hash: string;
}

async function readVerifiedBackup(
  path: string,
  deps: BackupWorkflowDependencies
): Promise<{ envelope: BackupEnvelope; record: BackupRecord }> {
  const content = await deps.store.readText(path);
  const envelope = JSON.parse(content) as BackupEnvelope;
  assertManifest(envelope.manifest);

  if (deps.hash(envelope.payload) !== envelope.manifest.contentHash) {
    throw new Error('Backup hash mismatch');
  }
  if (deps.hash({ manifest: envelope.manifest, payload: envelope.payload }) !== envelope.hash) {
    throw new Error('Backup hash mismatch');
  }

  const saved = await deps.repository.findBackupByPath(path);
  const record = saved ?? recordFromEnvelope(path, envelope, content);

  if (record.hash !== envelope.hash || record.manifest.contentHash !== envelope.manifest.contentHash) {
    throw new Error('Backup manifest mismatch');
  }

  return { envelope, record };
}

function assertManifest(manifest: BackupWorkflowManifest | undefined): asserts manifest is BackupWorkflowManifest {
  if (!manifest?.backupId || !manifest.projectId || !manifest.createdAt || !manifest.contentHash) {
    throw new Error('Backup manifest is incomplete');
  }
}

function recordFromEnvelope(path: string, envelope: BackupEnvelope, content: string): BackupRecord {
  return {
    id: envelope.manifest.backupId,
    projectId: envelope.manifest.projectId,
    path,
    hash: envelope.hash,
    manifest: envelope.manifest,
    createdAt: envelope.manifest.createdAt,
    byteLength: Buffer.byteLength(content, 'utf8')
  };
}

function succeededJob(
  id: string,
  type: BackupWorkflowJobType,
  projectId: string,
  now: string,
  output: Record<string, unknown>
): BackupWorkflowJob {
  return {
    id,
    type,
    status: 'Succeeded',
    projectId,
    createdAt: now,
    updatedAt: now,
    output
  };
}

function failedJob(
  id: string,
  type: BackupWorkflowJobType,
  now: string,
  error: string,
  projectId?: string
): BackupWorkflowJob {
  return {
    id,
    type,
    status: 'Failed',
    projectId,
    createdAt: now,
    updatedAt: now,
    error
  };
}

function emptyRejectedRecord(path: string, now: string): BackupRecord {
  return {
    id: 'backup_rejected',
    projectId: 'project_unknown',
    path,
    hash: '',
    manifest: {
      backupId: 'backup_rejected',
      projectId: 'project_unknown',
      schemaVersion: 1,
      createdAt: now,
      contentHash: ''
    },
    createdAt: now,
    byteLength: 0
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inferBackupSections(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  return Object.entries(payload as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}
