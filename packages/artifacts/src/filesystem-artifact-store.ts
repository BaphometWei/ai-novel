import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ArtifactStore, StoredArtifact } from './artifact-store';
import { sha256 } from './hash';

export class FilesystemArtifactStore implements ArtifactStore {
  constructor(private readonly root: string) {}

  async writeText(name: string, content: string): Promise<StoredArtifact> {
    const hash = sha256(content);
    const safeName = basename(name);
    const uri = join(hash.slice('sha256:'.length, 'sha256:'.length + 2), `${hash.slice('sha256:'.length)}-${safeName}`);
    const absolutePath = join(this.root, uri);

    await mkdir(join(this.root, uri, '..'), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');

    return { hash, uri };
  }

  async readText(uri: string): Promise<string> {
    return readFile(join(this.root, uri), 'utf8');
  }
}
