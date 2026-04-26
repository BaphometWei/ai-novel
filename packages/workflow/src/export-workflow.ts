import { createProjectBundle, hashProjectBundle, type ProjectBundle, type ProjectBundleInput } from '@ai-novel/domain';
import type { LocalProject } from './import-workflow';

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
