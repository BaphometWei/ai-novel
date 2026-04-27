import type { Client } from '@libsql/client';

export interface SearchDocument {
  id: string;
  projectId: string;
  sourceType: 'canon_fact' | 'manuscript' | 'knowledge' | 'review_finding' | 'reader_feedback';
  title: string;
  body: string;
}

export interface SearchQuery {
  projectId: string;
  query: string;
}

export interface SearchResult {
  id: string;
  sourceType: SearchDocument['sourceType'];
  title: string;
  snippet: string;
}

export class SearchRepository {
  constructor(private readonly client: Client) {}

  async indexDocument(document: SearchDocument): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO search_documents (id, project_id, source_type, title, body)
        VALUES (?, ?, ?, ?, ?)`,
      args: [document.id, document.projectId, document.sourceType, document.title, document.body]
    });
  }

  async search(input: SearchQuery): Promise<SearchResult[]> {
    const result = await this.client.execute({
      sql: `SELECT id, source_type, title, snippet(search_documents, 4, '[', ']', '...', 12) AS snippet
        FROM search_documents
        WHERE project_id = ? AND search_documents MATCH ?
        ORDER BY rank`,
      args: [input.projectId, input.query]
    });

    return result.rows.map((row) => ({
      id: String(row.id),
      sourceType: row.source_type as SearchResult['sourceType'],
      title: String(row.title),
      snippet: String(row.snippet)
    }));
  }
}
