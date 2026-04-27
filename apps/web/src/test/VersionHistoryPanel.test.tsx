import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type VersionHistoryApiClient, type VersionHistorySnapshot } from '../api/client';
import { VersionHistoryPanel } from '../components/VersionHistoryPanel';

describe('VersionHistoryPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders snapshots, trace links, restore points, and creates a snapshot for the project', async () => {
    const client = mockVersionHistoryClient();
    const createSnapshot = vi.spyOn(client, 'createVersionHistorySnapshot');

    render(<VersionHistoryPanel client={client} projectId="project_1" />);

    expect(await screen.findByRole('heading', { name: 'Version History' })).toBeInTheDocument();
    expect(screen.getByText('snapshot_existing')).toBeInTheDocument();
    expect(screen.getByText('canon_1 -> chapter_1: grounds')).toBeInTheDocument();
    expect(screen.getByText('chapter_1 v3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create snapshot' }));

    expect(await screen.findByText('snapshot_created')).toBeInTheDocument();
    expect(createSnapshot).toHaveBeenCalledWith('project_1', expect.objectContaining({
      entities: expect.arrayContaining([expect.objectContaining({ id: 'chapter_1', type: 'manuscript' })]),
      links: expect.arrayContaining([expect.objectContaining({ from: 'canon_1', to: 'chapter_1' })])
    }));
  });

  it('calls version history routes through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/version-history/project_1') return jsonResponse([snapshot]);
      if (path === '/api/version-history/project_1/snapshots/snapshot_existing') return jsonResponse(snapshot);
      if (path === '/api/version-history/project_1/snapshots' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          createdAt: '2026-04-27T08:00:00.000Z',
          entities: [{ id: 'chapter_1', type: 'manuscript', version: 3, label: 'Chapter 1 v3' }],
          links: [{ from: 'canon_1', to: 'chapter_1', relation: 'grounds' }]
        });
        return jsonResponse(snapshot, true, 201);
      }
      return jsonResponse({}, false, 404);
    });

    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.listVersionHistorySnapshots('project_1')).resolves.toEqual([snapshot]);
    await expect(client.getVersionHistorySnapshot('project_1', 'snapshot_existing')).resolves.toEqual(snapshot);
    await expect(
      client.createVersionHistorySnapshot('project_1', {
        createdAt: '2026-04-27T08:00:00.000Z',
        entities: [{ id: 'chapter_1', type: 'manuscript', version: 3, label: 'Chapter 1 v3' }],
        links: [{ from: 'canon_1', to: 'chapter_1', relation: 'grounds' }]
      })
    ).resolves.toEqual(snapshot);

    expect(fetchImpl).toHaveBeenCalledWith('/api/version-history/project_1');
    expect(fetchImpl).toHaveBeenCalledWith('/api/version-history/project_1/snapshots/snapshot_existing');
    expect(fetchImpl).toHaveBeenCalledWith('/api/version-history/project_1/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        createdAt: '2026-04-27T08:00:00.000Z',
        entities: [{ id: 'chapter_1', type: 'manuscript', version: 3, label: 'Chapter 1 v3' }],
        links: [{ from: 'canon_1', to: 'chapter_1', relation: 'grounds' }]
      })
    });
  });
});

function mockVersionHistoryClient(): VersionHistoryApiClient {
  let snapshots = [snapshot];
  return {
    listVersionHistorySnapshots: async () => snapshots,
    getVersionHistorySnapshot: async () => snapshots[0],
    createVersionHistorySnapshot: async (_projectId, input) => {
      snapshots = [{ id: 'snapshot_created', projectId: 'project_1', history: { ...input, trace: { createdAt: input.createdAt, links: input.links }, restorePoints: [{ entityId: 'chapter_1', version: 3 }] }, createdAt: input.createdAt }, ...snapshots];
      return snapshots[0];
    }
  };
}

const snapshot: VersionHistorySnapshot = {
  id: 'snapshot_existing',
  projectId: 'project_1',
  createdAt: '2026-04-27T08:00:00.000Z',
  history: {
    entities: [
      { id: 'chapter_1', type: 'manuscript', version: 3, label: 'Chapter 1 v3' },
      { id: 'canon_1', type: 'canon', version: 1, label: 'Canon Fact v1' }
    ],
    trace: {
      createdAt: '2026-04-27T08:00:00.000Z',
      links: [{ from: 'canon_1', to: 'chapter_1', relation: 'grounds' }]
    },
    restorePoints: [{ entityId: 'chapter_1', version: 3 }]
  }
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
