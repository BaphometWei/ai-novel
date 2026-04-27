import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type ObservabilityApiClient, type ProductObservabilitySummary } from '../api/client';
import { ObservabilityDashboard } from '../components/ObservabilityDashboard';

afterEach(() => {
  cleanup();
});

describe('ObservabilityDashboard', () => {
  it('loads and renders product observability summary from the injected client', async () => {
    const client = mockObservabilityClient();
    const loadSummary = vi.spyOn(client, 'loadObservabilitySummary');

    render(<ObservabilityDashboard client={client} />);

    expect(screen.getByText('Observability')).toBeInTheDocument();
    expect(screen.getByText('Loading observability...')).toBeInTheDocument();

    expect(await screen.findByText('$12.35')).toBeInTheDocument();
    expect(loadSummary).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('$2.47/run')).toBeInTheDocument();
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('9,876 total')).toBeInTheDocument();
    expect(screen.getByText('1,975/run')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    expect(screen.getByText('432 ms avg')).toBeInTheDocument();
    expect(screen.getByText('900 ms p95')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('75% accepted')).toBeInTheDocument();
    expect(screen.getByText('accepted 3, needs_revision 1')).toBeInTheDocument();
    expect(screen.getByText('Adoption')).toBeInTheDocument();
    expect(screen.getByText('50% adopted')).toBeInTheDocument();
    expect(screen.getByText('partial 25%, rejected 25%')).toBeInTheDocument();
    expect(screen.getByText('Model usage')).toBeInTheDocument();
    expect(screen.getByText('gpt-5-mini 7 runs')).toBeInTheDocument();
    expect(screen.getByText('Run errors')).toBeInTheDocument();
    expect(screen.getByText('schema_validation 2 retryable 1')).toBeInTheDocument();
    expect(screen.getByText('Workflow bottlenecks')).toBeInTheDocument();
    expect(screen.getByText('generate-draft 1,200 ms avg')).toBeInTheDocument();
    expect(screen.getByText('Data quality')).toBeInTheDocument();
    expect(screen.getByText('4 open, 2 high')).toBeInTheDocument();
  });

  it('shows an error state when the observability summary cannot be loaded', async () => {
    render(<ObservabilityDashboard client={mockObservabilityClient({ reject: true })} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Observability summary failed');
  });
});

describe('observability API client helpers', () => {
  it('loads product observability summary through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === '/api/observability/summary') {
        return jsonResponse(observabilitySummary);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    const summary = await client.loadObservabilitySummary();

    expect(summary.cost.totalUsd).toBe(12.345);
    expect(summary.modelUsage[0]).toEqual(expect.objectContaining({ modelName: 'gpt-5-mini', runCount: 7 }));
    expect(summary.runErrors[0]).toEqual(expect.objectContaining({ code: 'schema_validation', retryableCount: 1 }));
    expect(summary.workflowBottlenecks[0]).toEqual(expect.objectContaining({ stepName: 'generate-draft' }));
    expect(summary.dataQuality?.openIssueCount).toBe(4);
    expect(fetchImpl).toHaveBeenCalledWith('/api/observability/summary');
  });
});

function mockObservabilityClient(options: { reject?: boolean } = {}): ObservabilityApiClient {
  return {
    loadObservabilitySummary: async () => {
      if (options.reject) throw new Error('Observability summary failed');
      return observabilitySummary;
    }
  };
}

const observabilitySummary: ProductObservabilitySummary = {
  cost: {
    totalUsd: 12.345,
    averageUsdPerRun: 2.469
  },
  latency: {
    averageDurationMs: 432,
    p95DurationMs: 900
  },
  tokens: {
    total: 9876,
    averagePerRun: 1975.2
  },
  quality: {
    acceptedRate: 0.75,
    openIssueCount: 4,
    highSeverityOpenCount: 2,
    outcomes: {
      accepted: 3,
      needs_revision: 1
    }
  },
  adoption: {
    adoptedRate: 0.5,
    partialRate: 0.25,
    rejectedRate: 0.25,
    byFeature: {
      'gpt-5-mini': {
        adopted: 2,
        partial: 1,
        rejected: 1
      }
    }
  },
  modelUsage: [
    {
      modelProvider: 'openai',
      modelName: 'gpt-5-mini',
      runCount: 7,
      totalTokens: 9876,
      totalCostUsd: 12.345
    }
  ],
  runErrors: [
    {
      code: 'schema_validation',
      count: 2,
      retryableCount: 1,
      maxSeverity: 'Error'
    }
  ],
  workflowBottlenecks: [
    {
      workflowType: 'draft',
      stepName: 'generate-draft',
      runCount: 3,
      averageDurationMs: 1200,
      failureRate: 0.33,
      retryPressure: 2
    }
  ],
  dataQuality: {
    openIssueCount: 4,
    highSeverityOpenCount: 2
  }
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
