export interface StoredArtifact {
  hash: string;
  uri: string;
}

export interface ArtifactStore {
  writeText(name: string, content: string): Promise<StoredArtifact>;
  readText(uri: string): Promise<string>;
}
