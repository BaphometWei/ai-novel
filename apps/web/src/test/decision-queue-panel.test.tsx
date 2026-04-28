import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type ApprovalItem, type ApprovalsApiClient } from '../api/client';
import { DecisionQueuePanel } from '../components/DecisionQueuePanel';

describe('DecisionQueuePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads pending approvals for the selected project', async () => {
    const client = mockApprovalsClient({
      items: [approvalItem({ id: 'approval_1', projectId: 'project_1' }), approvalItem({ id: 'approval_2', projectId: 'project_2' })]
    });

    render(<DecisionQueuePanel client={client} projectId="project_1" />);

    expect(screen.getByText('Loading decisions...')).toBeInTheDocument();
    expect(await screen.findByText('Approve canon change?')).toBeInTheDocument();
    expect(screen.queryByText('approval_2')).not.toBeInTheDocument();
    expect(client.listPendingApprovals).toHaveBeenCalledWith({ projectId: 'project_1' });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('approves a pending decision and removes it from the queue', async () => {
    const client = mockApprovalsClient({ items: [approvalItem()] });

    render(<DecisionQueuePanel client={client} projectId="project_1" />);

    await screen.findByText('Approve canon change?');
    fireEvent.click(screen.getByRole('button', { name: 'Approve Approve canon change?' }));

    expect(await screen.findByText('No blocking decisions.')).toBeInTheDocument();
    expect(client.approve).toHaveBeenCalledWith('approval_1', { decidedBy: 'operator' });
  });

  it('rejects a pending decision and removes it from the queue', async () => {
    const client = mockApprovalsClient({ items: [approvalItem()] });

    render(<DecisionQueuePanel client={client} projectId="project_1" />);

    await screen.findByText('Approve canon change?');
    fireEvent.click(screen.getByRole('button', { name: 'Reject Approve canon change?' }));

    expect(await screen.findByText('No blocking decisions.')).toBeInTheDocument();
    expect(client.reject).toHaveBeenCalledWith('approval_1', { decidedBy: 'operator' });
  });

  it('shows an empty state when no selected-project decisions are pending', async () => {
    render(<DecisionQueuePanel client={mockApprovalsClient({ items: [approvalItem({ projectId: 'project_2' })] })} projectId="project_1" />);

    expect(await screen.findByText('No blocking decisions.')).toBeInTheDocument();
  });

  it('shows an error state when approvals cannot be loaded', async () => {
    render(<DecisionQueuePanel client={mockApprovalsClient({ rejectList: true })} projectId="project_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Approval service down');
  });

  it('disables decision buttons while a decision is posting', async () => {
    let resolveApprove: (value: ApprovalItem) => void = () => undefined;
    const client = mockApprovalsClient({
      items: [approvalItem()],
      approveImpl: () =>
        new Promise<ApprovalItem>((resolve) => {
          resolveApprove = resolve;
        })
    });

    render(<DecisionQueuePanel client={client} projectId="project_1" />);

    const item = await screen.findByRole('article', { name: 'Approve canon change?' });
    fireEvent.click(within(item).getByRole('button', { name: 'Approve Approve canon change?' }));

    expect(within(item).getByRole('button', { name: 'Approve Approve canon change?' })).toBeDisabled();
    expect(within(item).getByRole('button', { name: 'Reject Approve canon change?' })).toBeDisabled();

    resolveApprove(approvalItem({ status: 'Approved' }));
    expect(await screen.findByText('No blocking decisions.')).toBeInTheDocument();
  });
});

describe('approval API client helpers', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads and filters pending approvals by selected project and posts decisions', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/approvals') {
        return jsonResponse({
          items: [
            approvalItem({ id: 'approval_1', projectId: 'project_1' }),
            approvalItem({ id: 'approval_2', projectId: 'project_2' })
          ]
        });
      }
      if (path === '/api/approvals/approval_1/approve' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ decidedBy: 'operator' });
        return jsonResponse(approvalItem({ id: 'approval_1', projectId: 'project_1', status: 'Approved' }));
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.listPendingApprovals({ projectId: 'project_1' })).resolves.toEqual([
      expect.objectContaining({ id: 'approval_1', projectId: 'project_1' })
    ]);
    await expect(client.approve('approval_1', { decidedBy: 'operator' })).resolves.toMatchObject({ status: 'Approved' });
  });
});

function mockApprovalsClient(
  options: {
    items?: ApprovalItem[];
    rejectList?: boolean;
    approveImpl?: (id: string) => Promise<ApprovalItem>;
  } = {}
): ApprovalsApiClient {
  let items = options.items ?? [approvalItem()];

  return {
    listPendingApprovals: vi.fn(async (input?: { projectId?: string }) => {
      if (options.rejectList) throw new Error('Approval service down');
      return input?.projectId ? items.filter((item) => item.projectId === input.projectId) : items;
    }),
    approve: vi.fn(async (id: string) => {
      const updated = options.approveImpl ? await options.approveImpl(id) : approvalItem({ id, status: 'Approved' });
      items = items.filter((item) => item.id !== id);
      return updated;
    }),
    reject: vi.fn(async (id: string) => {
      const updated = approvalItem({ id, status: 'Rejected' });
      items = items.filter((item) => item.id !== id);
      return updated;
    })
  };
}

function approvalItem(overrides: Partial<ApprovalItem> = {}): ApprovalItem {
  return {
    id: 'approval_1',
    projectId: 'project_1',
    kind: 'approval',
    targetType: 'canon_fact',
    targetId: 'fact_1',
    title: 'Approve canon change?',
    riskLevel: 'High',
    reason: 'Canon conflict',
    proposedAction: 'Accept canon update',
    status: 'Pending',
    createdAt: '2026-04-28T00:00:00.000Z',
    ...overrides
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
