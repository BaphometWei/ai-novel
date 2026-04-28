import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectDashboard } from '../components/ProjectDashboard';
import type { ApiClient } from '../api/client';

describe('ProjectDashboard', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows loading state before rendering project data and chapter count from the API client', async () => {
    const onProjectLoaded = vi.fn();

    render(<ProjectDashboard client={mockClient()} onProjectLoaded={onProjectLoaded} />);

    expect(screen.getByText('Loading project...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Long Night' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('2 chapters loaded.')).toBeInTheDocument();
    expect(screen.getByText('External models allowed')).toBeInTheDocument();
    expect(onProjectLoaded).toHaveBeenCalledWith({
      id: 'project_1',
      title: 'Long Night',
      status: 'Active',
      externalModelPolicy: 'Allowed'
    });
  });

  it('updates the project external model policy from the dashboard', async () => {
    const client = mockClient();

    render(<ProjectDashboard client={client} />);

    expect(await screen.findByText('External models allowed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disable external models' }));

    expect(await screen.findByText('External models disabled')).toBeInTheDocument();
    expect(client.updateProjectExternalModelPolicy).toHaveBeenCalledWith('project_1', 'Disabled');
  });

  it('shows external model policy update errors without changing the loaded policy', async () => {
    const client = mockClient({ rejectPolicyUpdate: true });

    render(<ProjectDashboard client={client} />);

    expect(await screen.findByText('External models allowed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disable external models' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Policy update failed');
    expect(screen.getByText('External models allowed')).toBeInTheDocument();
  });

  it('shows an error state when the project summary cannot be loaded', async () => {
    render(<ProjectDashboard client={mockClient({ reject: true })} />);

    expect(await screen.findByText('Unable to load project dashboard.')).toBeInTheDocument();
    expect(screen.getByText('Network down')).toBeInTheDocument();
  });

  it('uses the browser API client by default without recreating requests after loading', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path === '/projects') return jsonResponse([{ id: 'project_1', title: 'Default Project' }]);
      if (path === '/projects/project_1') return jsonResponse({ id: 'project_1', title: 'Default Project', externalModelPolicy: 'Allowed' });
      if (path === '/projects/project_1/chapters') return jsonResponse([]);
      if (path === '/approvals') return jsonResponse({ items: [] });
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchImpl);

    render(<ProjectDashboard />);

    expect(await screen.findByRole('heading', { name: 'Default Project' })).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('renders approvals and posts global search requests using the API contract', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/projects') return jsonResponse([{ id: 'project_1', title: 'Default Project' }]);
      if (path === '/projects/project_1') return jsonResponse({ id: 'project_1', title: 'Default Project', externalModelPolicy: 'Allowed' });
      if (path === '/projects/project_1/chapters') return jsonResponse([]);
      if (path === '/approvals') {
        return jsonResponse({
          items: [
            {
              id: 'approval_1',
              projectId: 'project_1',
              kind: 'approval',
              targetType: 'canon_fact',
              targetId: 'fact_1',
              title: 'Approve canon change?',
              riskLevel: 'High',
              reason: 'Canon conflict',
              proposedAction: 'Accept',
              status: 'Pending',
              createdAt: '2026-04-27T00:00:00.000Z'
            }
          ]
        });
      }
      if (path === '/search') {
        expect(JSON.parse(String(init?.body))).toEqual({ projectId: 'project_1', query: 'lantern' });
        return jsonResponse({
          results: [
            {
              id: 'result_1',
              projectId: 'project_1',
              type: 'canon',
              title: 'Lantern Key',
              snippet: 'The key was hidden in the lantern.',
              score: 0.9
            }
          ]
        });
      }
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchImpl);

    render(<ProjectDashboard />);

    expect(await screen.findByText('Approve canon change? — Pending')).toBeInTheDocument();
    const input = screen.getByLabelText('Global search input');
    fireEvent.change(input, { target: { value: 'lantern' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Lantern Key')).toBeInTheDocument();
    expect(screen.getByText('The key was hidden in the lantern.')).toBeInTheDocument();
  });
});

function mockClient(options: { reject?: boolean; rejectPolicyUpdate?: boolean } = {}): ApiClient {
  return {
    fetchHealth: async () => ({ ok: true, service: 'test' }),
    listProjects: async () => {
      if (options.reject) throw new Error('Network down');
      return [{ id: 'project_1', title: 'Long Night' }];
    },
    getProjectSummary: async () => ({
      id: 'project_1',
      title: 'Long Night',
      status: 'Active',
      externalModelPolicy: 'Allowed'
    }),
    updateProjectExternalModelPolicy: vi.fn(async (_projectId, externalModelPolicy) => {
      if (options.rejectPolicyUpdate) throw new Error('Policy update failed');
      return {
        id: 'project_1',
        title: 'Long Night',
        status: 'Active',
        externalModelPolicy
      };
    }),
    listProjectChapters: async () => [
      { id: 'chapter_1', title: 'Opening' },
      { id: 'chapter_2', title: 'Reversal' }
    ],
    getChapterCurrentBody: async () => null
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
