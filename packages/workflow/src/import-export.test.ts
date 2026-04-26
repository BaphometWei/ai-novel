import { describe, expect, it } from 'vitest';
import { exportProjectBundle, restoreProjectBundle } from './export-workflow';
import { importIntoProject } from './import-workflow';
import {
  exportProjectBundle as exportProjectBundleFromIndex,
  importIntoProject as importIntoProjectFromIndex,
  restoreProjectBundle as restoreProjectBundleFromIndex
} from './index';

describe('import/export workflows', () => {
  it('imports source items into an in-memory project with raw artifacts', () => {
    const project = {
      project: { id: 'project_1', title: 'Sky Archive' },
      chapters: [],
      artifacts: [],
      canon: [],
      knowledgeItems: [],
      sourcePolicies: [],
      runLogs: [],
      settingsSnapshot: {}
    };

    const result = importIntoProject(project, {
      createdAt: '2026-04-27T00:00:00.000Z',
      items: [
        { sourceType: 'markdown', name: 'one.md', content: '# One\nScene text.' },
        { sourceType: 'user-note', name: 'note', content: 'Keep the tower secret.' }
      ]
    });

    expect(result.project.chapters).toEqual([expect.objectContaining({ title: 'One', body: 'Scene text.' })]);
    expect(result.project.artifacts).toHaveLength(2);
    expect(result.project.knowledgeItems).toEqual([
      expect.objectContaining({
        status: 'candidate',
        type: 'note',
        text: 'Keep the tower secret.'
      })
    ]);
    expect(result.batch.items.map((item) => item.rawArtifact.id)).toEqual(
      result.project.artifacts.map((artifact) => artifact.id)
    );
  });

  it('exports and restores a project bundle with matching hashes', () => {
    const original = {
      project: { id: 'project_1', title: 'Sky Archive' },
      chapters: [{ id: 'chapter_1', title: 'Opening', body: 'Start' }],
      artifacts: [{ id: 'artifact_1', kind: 'raw-import', hash: 'abc' }],
      canon: [{ id: 'canon_1', text: 'Magic has a cost' }],
      knowledgeItems: [{ id: 'knowledge_1', text: 'Technique note' }],
      sourcePolicies: [{ id: 'policy_1', sampleId: 'sample_1', usage: 'allowed' }],
      runLogs: [{ id: 'run_1', agent: 'writer', status: 'complete' }],
      settingsSnapshot: { provider: 'local' }
    };

    const bundle = exportProjectBundle(original, {
      createdAt: '2026-04-27T00:00:00.000Z'
    });
    const restored = restoreProjectBundle(bundle, { newProjectId: 'project_restored' });

    expect(restored.project.project).toEqual({
      id: 'project_restored',
      title: 'Sky Archive',
      restoredFromProjectId: 'project_1'
    });
    expect(restored.project.chapters).toEqual(original.chapters);
    expect(restored.project.artifacts).toEqual(original.artifacts);
    expect(restored.project.canon).toEqual(original.canon);
    expect(restored.project.knowledgeItems).toEqual(original.knowledgeItems);
    expect(restored.project.sourcePolicies).toEqual(original.sourcePolicies);
    expect(restored.project.runLogs).toEqual(original.runLogs);
    expect(restored.project.settingsSnapshot).toEqual(original.settingsSnapshot);
    expect(restored.sourceBundleHash).toBe(bundle.hash);
    expect(restored.restoredBundleHash).toBe(bundle.hash);
  });

  it('exports import/export workflows from the workflow package index', () => {
    expect(importIntoProjectFromIndex).toBe(importIntoProject);
    expect(exportProjectBundleFromIndex).toBe(exportProjectBundle);
    expect(restoreProjectBundleFromIndex).toBe(restoreProjectBundle);
  });
});
