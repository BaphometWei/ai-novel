import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApiClient,
  type ScheduledBackupApiClient,
  type ScheduledBackupPolicy,
  type ScheduledBackupPolicyInput
} from '../api/client';
import { ScheduledBackupPanel } from '../components/ScheduledBackupPanel';

describe('ScheduledBackupPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows policies, due intents, and records deterministic run success and failure', async () => {
    const client = mockScheduledBackupClient();
    render(<ScheduledBackupPanel client={client} now="2026-04-27T12:00:00.000Z" />);

    expect(screen.getByRole('heading', { name: 'Scheduled Backups' })).toBeInTheDocument();
    expect(screen.getByText('Loading scheduled backups...')).toBeInTheDocument();

    const policies = await screen.findByLabelText('Scheduled backup policies');
    expect(within(policies).getByText('policy_daily')).toBeInTheDocument();
    expect(within(policies).getByText('daily')).toBeInTheDocument();
    expect(within(policies).getByText('Succeeded')).toBeInTheDocument();

    const due = screen.getByLabelText('Due backup intents');
    expect(within(due).getByText('backup:project_demo:policy_daily')).toBeInTheDocument();
    expect(within(due).getByText('memory://backups')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark success' }));
    expect(await screen.findByText('Run Succeeded')).toBeInTheDocument();
    expect(screen.getByText('2026-04-28T12:00:00.000Z')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark failure' }));
    expect(await screen.findByText('Run Failed')).toBeInTheDocument();
  });

  it('shows loading errors', async () => {
    render(<ScheduledBackupPanel client={mockScheduledBackupClient({ rejectList: true })} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Scheduled backup load failed');
  });
});

describe('scheduled backup API client helpers', () => {
  it('calls policy, due, and run endpoints through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/scheduled-backups/policies/policy_daily') {
        expect(init?.method).toBe('PUT');
        expect(JSON.parse(String(init?.body))).toEqual(policyInput);
        return jsonResponse(policy);
      }
      if (path === '/api/scheduled-backups/policies') return jsonResponse([policy]);
      if (path === '/api/scheduled-backups/due?now=2026-04-27T12%3A00%3A00.000Z') return jsonResponse(dueResult);
      if (path === '/api/scheduled-backups/policies/policy_daily/runs') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ completedAt: '2026-04-27T12:00:00.000Z', status: 'Succeeded' });
        return jsonResponse(updatedPolicy);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.upsertScheduledBackupPolicy('policy_daily', policyInput)).resolves.toEqual(policy);
    await expect(client.listScheduledBackupPolicies()).resolves.toEqual([policy]);
    await expect(client.listDueScheduledBackups('2026-04-27T12:00:00.000Z')).resolves.toEqual(dueResult);
    await expect(
      client.recordScheduledBackupRun('policy_daily', { completedAt: '2026-04-27T12:00:00.000Z', status: 'Succeeded' })
    ).resolves.toEqual(updatedPolicy);
  });
});

function mockScheduledBackupClient(options: { rejectList?: boolean } = {}): ScheduledBackupApiClient {
  return {
    upsertScheduledBackupPolicy: async () => policy,
    listScheduledBackupPolicies: async () => {
      if (options.rejectList) throw new Error('Scheduled backup load failed');
      return [policy];
    },
    listDueScheduledBackups: async () => dueResult,
    recordScheduledBackupRun: async (_id, input) => ({
      ...updatedPolicy,
      lastRunStatus: input.status
    })
  };
}

const policyInput: ScheduledBackupPolicyInput = {
  projectId: 'project_demo',
  cadence: 'daily',
  targetPathPrefix: 'memory://backups',
  enabled: true,
  lastRunAt: '2026-04-26T12:00:00.000Z',
  nextRunAt: '2026-04-27T12:00:00.000Z',
  retentionCount: 7,
  lastRunStatus: 'Succeeded'
};

const policy: ScheduledBackupPolicy = {
  id: 'policy_daily',
  ...policyInput
};

const updatedPolicy: ScheduledBackupPolicy = {
  ...policy,
  lastRunAt: '2026-04-27T12:00:00.000Z',
  nextRunAt: '2026-04-28T12:00:00.000Z',
  lastRunStatus: 'Succeeded'
};

const dueResult = {
  policies: [policy],
  intents: [
    {
      id: 'backup:project_demo:policy_daily',
      policyId: 'policy_daily',
      projectId: 'project_demo',
      targetPathPrefix: 'memory://backups',
      scheduledAt: '2026-04-27T12:00:00.000Z'
    }
  ]
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
