import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBaseUrl } from '../api/client';
import { App } from '../App';

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the writing cockpit dashboard', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'AI Novel Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Decision Queue')).toBeInTheDocument();
    expect(screen.getByText('Current Project')).toBeInTheDocument();
    expect(screen.getByText('Observability')).toBeInTheDocument();
  });

  it('loads the project dashboard through an injected API base URL and fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path === '/api/projects') {
        return jsonResponse([{ id: 'project_api', title: 'API Project' }]);
      }
      if (path === '/api/projects/project_api') {
        return jsonResponse({ id: 'project_api', title: 'API Project', status: 'Active' });
      }
      if (path === '/api/projects/project_api/chapters') {
        return jsonResponse([
          { id: 'chapter_1', title: 'Opening' },
          { id: 'chapter_2', title: 'Turn' }
        ]);
      }
      if (path === '/api/settings/providers/openai') {
        return jsonResponse({
          provider: 'openai',
          defaultModel: 'gpt-default',
          secretRef: 'env:OPENAI_API_KEY',
          redactedMetadata: {},
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      if (path === '/api/settings/model-routing/defaults') {
        return jsonResponse({
          provider: 'openai',
          draftingModel: 'gpt-draft',
          reviewModel: 'gpt-review',
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      if (path === '/api/settings/budgets/defaults') {
        return jsonResponse({
          provider: 'openai',
          maxRunCostUsd: 0.5,
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      if (path === '/api/settings/source-policy/defaults') {
        return jsonResponse({
          allowUserSamples: true,
          allowLicensedSamples: false,
          allowPublicDomain: true,
          restrictedSourceIds: [],
          updatedAt: '2026-04-27T00:00:00.000Z'
        });
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });

    render(<App apiBaseUrl="/api" fetchImpl={fetchImpl} />);

    expect(await screen.findByRole('heading', { name: 'API Project' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Provider Defaults' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith('/api/projects');
  });

  it('resolves the runtime API base URL from Vite environment', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: 'http://127.0.0.1:4000' })).toBe('http://127.0.0.1:4000');
    expect(resolveApiBaseUrl({})).toBe('/api');
  });
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
