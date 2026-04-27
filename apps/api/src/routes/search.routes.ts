import type { SearchRepository, SearchResult as RepositorySearchResult } from '@ai-novel/db';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export type GlobalSearchResultType = 'manuscript' | 'canon' | 'knowledge' | 'runs' | 'review' | 'feedback';

export interface GlobalSearchResult {
  id: string;
  projectId: string;
  type: GlobalSearchResultType;
  title: string;
  snippet: string;
  score?: number;
}

export interface GlobalSearchInput {
  projectId: string;
  query: string;
  types?: GlobalSearchResultType[];
}

export interface GlobalSearchRouteStore {
  search(input: GlobalSearchInput): Promise<GlobalSearchResult[]> | GlobalSearchResult[];
}

const resultTypeSchema = z.enum(['manuscript', 'canon', 'knowledge', 'runs', 'review', 'feedback']);

const searchSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  types: z.array(resultTypeSchema).optional()
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid search payload' });
}

export function createInMemorySearchStore(results: GlobalSearchResult[] = []): GlobalSearchRouteStore {
  return {
    async search(input) {
      const normalizedQuery = input.query.toLowerCase();
      const allowedTypes = input.types ? new Set(input.types) : null;

      return results.filter((result) => {
        if (result.projectId !== input.projectId) return false;
        if (allowedTypes && !allowedTypes.has(result.type)) return false;
        return `${result.title} ${result.snippet}`.toLowerCase().includes(normalizedQuery);
      });
    }
  };
}

export function createRepositorySearchStore(repository: SearchRepository): GlobalSearchRouteStore {
  return {
    async search(input) {
      const allowedTypes = input.types ? new Set(input.types) : null;
      const results = await repository.search({ projectId: input.projectId, query: input.query });

      return results
        .map((result) => toGlobalResult(input.projectId, result))
        .filter((result) => !allowedTypes || allowedTypes.has(result.type));
    }
  };
}

export function registerSearchRoutes(app: FastifyInstance, store: GlobalSearchRouteStore = createInMemorySearchStore()) {
  app.post('/search', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.send({ results: await store.search(parsed.data) });
  });
}

function toGlobalResult(projectId: string, result: RepositorySearchResult): GlobalSearchResult {
  return {
    id: result.id,
    projectId,
    type: toGlobalType(result.sourceType),
    title: result.title,
    snippet: result.snippet
  };
}

function toGlobalType(sourceType: RepositorySearchResult['sourceType']): GlobalSearchResultType {
  switch (sourceType) {
    case 'canon_fact':
      return 'canon';
    case 'review_finding':
      return 'review';
    case 'reader_feedback':
      return 'feedback';
    case 'manuscript':
    case 'knowledge':
      return sourceType;
  }
}
