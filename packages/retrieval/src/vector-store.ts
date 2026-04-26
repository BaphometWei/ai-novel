export interface VectorSearchResult {
  id: string;
  score: number;
}

export interface VectorStoreAdapter {
  search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
}

export class EmptyVectorStore implements VectorStoreAdapter {
  async search(): Promise<VectorSearchResult[]> {
    return [];
  }
}
