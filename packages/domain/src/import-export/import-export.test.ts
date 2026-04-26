import { describe, expect, it } from 'vitest';
import { createImportBatch, createProjectBundle, hashProjectBundle } from './import-export';
import { createImportBatch as createImportBatchFromIndex } from '../index';

describe('import/export domain', () => {
  it('creates raw artifact records for supported import sources', () => {
    const batch = createImportBatch({
      projectId: 'project_1',
      createdAt: '2026-04-27T00:00:00.000Z',
      items: [
        { sourceType: 'txt', name: 'chapter-one.txt', content: 'Chapter One\nThe first scene.' },
        { sourceType: 'markdown', name: 'chapter-two.md', content: '# Chapter Two\nThe second scene.' },
        { sourceType: 'docx-metadata', name: 'outline.docx', metadata: { title: 'Outline', author: 'Writer' } },
        { sourceType: 'pasted-chapter', name: 'paste', content: 'A pasted chapter.' },
        { sourceType: 'character-sheet', name: 'Mira', content: 'Name: Mira\nGoal: Find the city' },
        { sourceType: 'user-note', name: 'rule', content: 'Magic costs memory.' },
        { sourceType: 'sample-entry', name: 'sample', content: 'A clipped technique note.' }
      ]
    });

    expect(batch.items).toHaveLength(7);
    expect(batch.items.map((item) => item.sourceType)).toEqual([
      'txt',
      'markdown',
      'docx-metadata',
      'pasted-chapter',
      'character-sheet',
      'user-note',
      'sample-entry'
    ]);
    expect(batch.items.every((item) => item.rawArtifact.kind === 'raw-import')).toBe(true);
    expect(batch.items.every((item) => item.rawArtifact.hash.length === 64)).toBe(true);
    expect(batch.items[0]?.extracted.chapter?.title).toBe('chapter-one');
    expect(batch.items[1]?.extracted.chapter?.title).toBe('Chapter Two');
    expect(batch.items[4]?.extracted.candidates[0]).toMatchObject({
      type: 'character',
      status: 'candidate',
      text: 'Name: Mira\nGoal: Find the city'
    });
  });

  it('keeps raw artifact ids unique for duplicate items in one import batch', () => {
    const batch = createImportBatch({
      projectId: 'project_1',
      createdAt: '2026-04-27T00:00:00.000Z',
      items: [
        { sourceType: 'txt', name: 'chapter-one.txt', content: 'Chapter One\nThe first scene.' },
        { sourceType: 'txt', name: 'chapter-one.txt', content: 'Chapter One\nThe first scene.' }
      ]
    });

    expect(batch.items.map((item) => item.rawArtifact.id)).toHaveLength(2);
    expect(new Set(batch.items.map((item) => item.rawArtifact.id)).size).toBe(2);
    expect(new Set(batch.items.map((item) => item.rawArtifact.hash)).size).toBe(1);
  });

  it('creates deterministic project bundles with all backup sections', () => {
    const bundle = createProjectBundle({
      project: { id: 'project_1', title: 'Sky Archive' },
      chapters: [{ id: 'chapter_1', title: 'Opening', body: 'Start' }],
      artifacts: [{ id: 'artifact_1', kind: 'raw-import', hash: 'abc' }],
      canon: [{ id: 'canon_1', text: 'Magic has a cost' }],
      knowledgeItems: [{ id: 'knowledge_1', text: 'Use cliffhangers sparingly' }],
      sourcePolicies: [{ id: 'policy_1', sampleId: 'sample_1', usage: 'restricted' }],
      runLogs: [{ id: 'run_1', agent: 'writer', status: 'complete' }],
      settingsSnapshot: { provider: 'local', temperature: 0.4 },
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    expect(bundle).toMatchObject({
      format: 'ai-novel-project-bundle',
      version: 1,
      project: { id: 'project_1', title: 'Sky Archive' }
    });
    expect(bundle.chapters).toHaveLength(1);
    expect(bundle.artifacts).toHaveLength(1);
    expect(bundle.canon).toHaveLength(1);
    expect(bundle.knowledgeItems).toHaveLength(1);
    expect(bundle.sourcePolicies).toHaveLength(1);
    expect(bundle.runLogs).toHaveLength(1);
    expect(bundle.settingsSnapshot).toEqual({ provider: 'local', temperature: 0.4 });
    expect(bundle.hash).toBe(hashProjectBundle(bundle));
  });

  it('exports import/export helpers from the domain package index', () => {
    expect(createImportBatchFromIndex).toBe(createImportBatch);
  });
});
