import { createProjectBundle, hashProjectBundle, type ProjectBundle, type ProjectBundleInput } from '@ai-novel/domain';
import type { LocalProject } from './import-workflow';

export interface BackupStorage {
  writeText(path: string, content: string): Promise<void> | void;
  readText(path: string): Promise<string> | string;
}

export interface ProjectBundleBackup {
  path: string;
  bundleHash: string;
  format: ProjectBundle['format'];
  version: ProjectBundle['version'];
  byteLength: number;
}

export interface BundleMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(bundle: ProjectBundle): ProjectBundle;
}

export interface RestoreRecord {
  id: string;
  bundleHash: string;
  sourceProjectId: unknown;
  targetProjectId: string;
  restoredAt: string;
  migrationsApplied: string[];
  rollbackActions: Array<{ type: 'delete_project'; targetId: string }>;
}

export function exportProjectBundle(project: LocalProject, options: { createdAt?: string } = {}): ProjectBundle {
  return createProjectBundle({
    ...project,
    createdAt: options.createdAt
  } satisfies ProjectBundleInput);
}

export function restoreProjectBundle(
  bundle: ProjectBundle,
  options: { newProjectId: string }
): { project: LocalProject; sourceBundleHash: string; restoredBundleHash: string } {
  const sourceProjectId = bundle.project.id;
  const project: LocalProject = {
    project: {
      ...bundle.project,
      id: options.newProjectId,
      restoredFromProjectId: sourceProjectId
    },
    chapters: clone(bundle.chapters),
    artifacts: clone(bundle.artifacts),
    canon: clone(bundle.canon),
    knowledgeItems: clone(bundle.knowledgeItems),
    sourcePolicies: clone(bundle.sourcePolicies),
    runLogs: clone(bundle.runLogs),
    settingsSnapshot: clone(bundle.settingsSnapshot)
  };

  return {
    project,
    sourceBundleHash: bundle.hash,
    restoredBundleHash: hashProjectBundle(bundle)
  };
}

export async function writeProjectBundleBackup(
  storage: BackupStorage,
  path: string,
  bundle: ProjectBundle
): Promise<ProjectBundleBackup> {
  const content = JSON.stringify(bundle, null, 2);
  await storage.writeText(path, content);

  return {
    path,
    bundleHash: bundle.hash,
    format: bundle.format,
    version: bundle.version,
    byteLength: Buffer.byteLength(content, 'utf8')
  };
}

export async function readProjectBundleBackup(
  storage: BackupStorage,
  path: string,
  options: { migrations?: BundleMigration[]; targetSchemaVersion?: number } = {}
): Promise<ProjectBundle> {
  return (await readProjectBundleBackupWithMigrations(storage, path, options)).bundle;
}

export async function restoreProjectBundleFromBackup(
  storage: BackupStorage,
  path: string,
  options: {
    newProjectId: string;
    restoredAt?: string;
    targetSchemaVersion?: number;
    migrations?: BundleMigration[];
  }
): Promise<ReturnType<typeof restoreProjectBundle> & { restoreRecord: RestoreRecord }> {
  const result = await readProjectBundleBackupWithMigrations(storage, path, {
    migrations: options.migrations,
    targetSchemaVersion: options.targetSchemaVersion
  });
  const bundle = result.bundle;
  const restored = restoreProjectBundle(bundle, { newProjectId: options.newProjectId });

  return {
    ...restored,
    restoreRecord: {
      id: `restore_${options.newProjectId}`,
      bundleHash: bundle.hash,
      sourceProjectId: bundle.project.id,
      targetProjectId: options.newProjectId,
      restoredAt: options.restoredAt ?? new Date().toISOString(),
      migrationsApplied: result.migrationsApplied,
      rollbackActions: [{ type: 'delete_project', targetId: options.newProjectId }]
    }
  };
}

async function readProjectBundleBackupWithMigrations(
  storage: BackupStorage,
  path: string,
  options: { migrations?: BundleMigration[]; targetSchemaVersion?: number }
): Promise<{ bundle: ProjectBundle; migrationsApplied: string[] }> {
  const content = await storage.readText(path);
  const bundle = JSON.parse(content) as ProjectBundle;
  assertBundleHash(bundle);

  const result = applyBundleMigrations(bundle, options);
  assertBundleHash(result.bundle);

  return result;
}

function applyBundleMigrations(
  bundle: ProjectBundle,
  options: { migrations?: BundleMigration[]; targetSchemaVersion?: number }
): { bundle: ProjectBundle; migrationsApplied: string[] } {
  let current = bundle;
  const targetSchemaVersion = options.targetSchemaVersion ?? bundle.version;
  const migrationsApplied: string[] = [];

  for (const migration of options.migrations ?? []) {
    if (current.version === migration.fromVersion && migration.toVersion <= targetSchemaVersion) {
      current = migration.migrate(current);
      migrationsApplied.push(migration.description);
    }
  }

  return { bundle: current, migrationsApplied };
}

function assertBundleHash(bundle: ProjectBundle): void {
  if (hashProjectBundle(bundle) !== bundle.hash) {
    throw new Error('Project bundle hash mismatch');
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
