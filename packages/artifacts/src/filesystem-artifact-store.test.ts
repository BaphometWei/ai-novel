import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FilesystemArtifactStore } from './filesystem-artifact-store';

describe('FilesystemArtifactStore', () => {
  it('writes content by hash and reads it back', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-novel-artifacts-'));
    const store = new FilesystemArtifactStore(root);

    const written = await store.writeText('context-pack.json', '{"task":"draft"}');

    expect(written.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    await expect(store.readText(written.uri)).resolves.toBe('{"task":"draft"}');
    await rm(root, { recursive: true, force: true });
  });

  it('rejects artifact uris that escape the store root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-novel-artifacts-'));
    const store = new FilesystemArtifactStore(root);

    await expect(store.readText('../outside.txt')).rejects.toThrow('Artifact URI escapes store root');
    await rm(root, { recursive: true, force: true });
  });

  it('rejects content tampered with on disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-novel-artifacts-'));
    const store = new FilesystemArtifactStore(root);

    const written = await store.writeText('context-pack.json', '{"task":"draft"}');
    await writeFile(join(root, written.uri), '{"task":"tampered"}', 'utf8');

    await expect(store.readText(written.uri)).rejects.toThrow('Artifact content hash mismatch');
    await rm(root, { recursive: true, force: true });
  });
});
