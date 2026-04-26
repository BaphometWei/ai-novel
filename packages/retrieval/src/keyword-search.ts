import type { RetrievalItem } from './retrieval-policy';

export interface KeywordSearchAdapter {
  search(query: string): Promise<RetrievalItem[]>;
}

export class InMemoryKeywordSearch implements KeywordSearchAdapter {
  constructor(private readonly items: RetrievalItem[]) {}

  async search(query: string): Promise<RetrievalItem[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.items.filter((item) => terms.some((term) => item.text.toLowerCase().includes(term)));
  }
}
