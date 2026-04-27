import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { ArtifactStore, StoredArtifact } from './artifact-store';
import { sha256 } from './hash';

export class FilesystemArtifactStore implements ArtifactStore {
  private readonly rootPath: string;

  constructor(root: string) {
    this.rootPath = resolve(root);
  }

  async writeText(name: string, content: string): Promise<StoredArtifact> {
    const hash = sha256(content);
    const safeName = basename(name);
    const uri = join(hash.slice('sha256:'.length, 'sha256:'.length + 2), `${hash.slice('sha256:'.length)}-${safeName}`);
    const absolutePath = this.resolveInsideRoot(uri);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');

    return { hash, uri };
  }

  async readText(uri: string): Promise<string> {
    const content = await readFile(this.resolveInsideRoot(uri), 'utf8');
    const expectedDigest = basename(uri).match(/^([a-f0-9]{64})-/)?.[1];
    if (!expectedDigest) {
      throw new Error('Artifact URI does not include a sha256 content hash');
    }

    const actualHash = sha256(content);
    const expectedHash = `sha256:${expectedDigest}`;
    if (actualHash !== expectedHash) {
      throw new Error(`Artifact content hash mismatch: expected ${expectedHash}, got ${actualHash}`);
    }

    return content;
  }

  private resolveInsideRoot(uri: string): string {
    const absolutePath = resolve(this.rootPath, uri);
    if (absolutePath !== this.rootPath && !absolutePath.startsWith(`${this.rootPath}\\`) && !absolutePath.startsWith(`${this.rootPath}/`)) {
      throw new Error('Artifact URI escapes store root');
    }
    return absolutePath;
  }
}
