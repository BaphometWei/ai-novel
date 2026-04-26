import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ObservabilityDashboard } from '../components/ObservabilityDashboard';

afterEach(() => {
  cleanup();
});

describe('ObservabilityDashboard', () => {
  it('renders cost, model, failure, retry, context, quality, and adoption signals', () => {
    render(<ObservabilityDashboard />);

    expect(screen.getByText('Observability')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('$1.75')).toBeInTheDocument();
    expect(screen.getByText('Model usage')).toBeInTheDocument();
    expect(screen.getByText('gpt-5')).toBeInTheDocument();
    expect(screen.getByText('Failure rate')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Retries')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Context length')).toBeInTheDocument();
    expect(screen.getByText('7,000 tokens avg')).toBeInTheDocument();
    expect(screen.getByText('Quality outcome')).toBeInTheDocument();
    expect(screen.getByText('accepted 1')).toBeInTheDocument();
    expect(screen.getByText('User adoption')).toBeInTheDocument();
    expect(screen.getByText('adopted 1')).toBeInTheDocument();
  });
});
