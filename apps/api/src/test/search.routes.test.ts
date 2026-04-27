import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { GlobalSearchRouteStore } from '../routes/search.routes';

describe('global search API routes', () => {
  it('returns a unified result shape across manuscript, canon, knowledge, runs, review, and feedback', async () => {
    const app = buildApp({ search: createSearchStore() });

    const response = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { projectId: 'project_1', query: 'lantern', types: ['manuscript', 'canon', 'knowledge', 'runs', 'review', 'feedback'] }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      results: [
        { id: 'chapter_1', projectId: 'project_1', type: 'manuscript', title: 'Chapter 1', snippet: 'The lantern flickered.', score: 1 },
        { id: 'fact_1', projectId: 'project_1', type: 'canon', title: 'Hidden key', snippet: 'The key is in the lantern.', score: 0.9 },
        { id: 'knowledge_1', projectId: 'project_1', type: 'knowledge', title: 'Locked room trope', snippet: 'Lantern misdirection.', score: 0.8 },
        { id: 'agent_run_1', projectId: 'project_1', type: 'runs', title: 'Draft run', snippet: 'Drafted the lantern reveal.', score: 0.7 },
        { id: 'finding_1', projectId: 'project_1', type: 'review', title: 'Continuity issue', snippet: 'Lantern clue appears too late.', score: 0.6 },
        { id: 'feedback_1', projectId: 'project_1', type: 'feedback', title: 'Reader feedback', snippet: 'Loved the lantern clue.', score: 0.5 }
      ]
    });
  });
});

function createSearchStore(): GlobalSearchRouteStore {
  return {
    async search(input) {
      expect(input).toEqual({
        projectId: 'project_1',
        query: 'lantern',
        types: ['manuscript', 'canon', 'knowledge', 'runs', 'review', 'feedback']
      });
      return [
        { id: 'chapter_1', projectId: 'project_1', type: 'manuscript', title: 'Chapter 1', snippet: 'The lantern flickered.', score: 1 },
        { id: 'fact_1', projectId: 'project_1', type: 'canon', title: 'Hidden key', snippet: 'The key is in the lantern.', score: 0.9 },
        { id: 'knowledge_1', projectId: 'project_1', type: 'knowledge', title: 'Locked room trope', snippet: 'Lantern misdirection.', score: 0.8 },
        { id: 'agent_run_1', projectId: 'project_1', type: 'runs', title: 'Draft run', snippet: 'Drafted the lantern reveal.', score: 0.7 },
        { id: 'finding_1', projectId: 'project_1', type: 'review', title: 'Continuity issue', snippet: 'Lantern clue appears too late.', score: 0.6 },
        { id: 'feedback_1', projectId: 'project_1', type: 'feedback', title: 'Reader feedback', snippet: 'Loved the lantern clue.', score: 0.5 }
      ];
    }
  };
}
