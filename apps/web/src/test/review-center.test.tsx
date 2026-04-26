import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReviewCenter } from '../components/ReviewCenter';
import { RevisionDiff } from '../components/RevisionDiff';

afterEach(() => {
  cleanup();
});

describe('review center revision diff flow', () => {
  it('shows a revision suggestion as a before and after diff with risk state', () => {
    render(
      <RevisionDiff
        suggestion={{
          title: 'Move secret use after reveal',
          rationale: 'Keeps the knowledge boundary intact.',
          before: 'Mira names the living bell before the reveal.',
          after: 'Mira hears the living bell but cannot name it yet.',
          risk: 'Medium',
          status: 'Proposed'
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Revision Diff' })).toBeInTheDocument();
    expect(screen.getByText('Move secret use after reveal')).toBeInTheDocument();
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('Mira names the living bell before the reveal.')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText('Mira hears the living bell but cannot name it yet.')).toBeInTheDocument();
    expect(screen.getByText('Risk: Medium')).toBeInTheDocument();
    expect(screen.getByText('Revision status: Proposed')).toBeInTheDocument();
  });

  it('keeps finding actions and revision status in sync', () => {
    render(<ReviewCenter />);

    expect(screen.getByText('Revision status: Proposed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Finding status: Applied')).toBeInTheDocument();
    expect(screen.getByText('Revision status: Applied')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText('Finding status: Rejected')).toBeInTheDocument();
    expect(screen.getByText('Revision status: Rejected')).toBeInTheDocument();
  });
});
