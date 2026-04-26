import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StoryBible } from '../components/StoryBible';
import { ReviewCenter } from '../components/ReviewCenter';
import { SerializationDesk } from '../components/SerializationDesk';
import { KnowledgeLibrary } from '../components/KnowledgeLibrary';

afterEach(() => {
  cleanup();
});

describe('workbench panels', () => {
  it('renders story bible narrative boards', () => {
    render(<StoryBible />);

    expect(screen.getByText('Reader Promises')).toBeInTheDocument();
    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('World Rules')).toBeInTheDocument();
  });

  it('renders review center actions', () => {
    render(<ReviewCenter />);

    expect(screen.getByText('Review Center')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Why' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convert to Task' })).toBeInTheDocument();
    expect(screen.getByText('Quality 76')).toBeInTheDocument();
  });

  it('updates review finding state from action buttons', () => {
    render(<ReviewCenter />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Finding status: Applied')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText('Finding status: Rejected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Why' }));
    expect(screen.getByText('Explanation requested from Continuity Sentinel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Convert to Task' }));
    expect(screen.getByText('Task created: Fix knowledge-boundary continuity issue')).toBeInTheDocument();
  });

  it('renders serialization and knowledge surfaces', () => {
    render(
      <>
        <SerializationDesk />
        <KnowledgeLibrary />
      </>
    );

    expect(screen.getByText('Serialization Desk')).toBeInTheDocument();
    expect(screen.getByText('Publish readiness')).toBeInTheDocument();
    expect(screen.getByText('Reader feedback')).toBeInTheDocument();
    expect(screen.getByText('Update calendar')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Library')).toBeInTheDocument();
    expect(screen.getByText('Source Policy')).toBeInTheDocument();
    expect(screen.getByText('Excluded from generation')).toBeInTheDocument();
  });

  it('updates serialization feedback and buffer state', () => {
    render(<SerializationDesk />);

    fireEvent.click(screen.getByRole('button', { name: 'Import Feedback' }));
    expect(screen.getByText('3 pacing notes, 1 hook praise')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Buffer Chapter' }));
    expect(screen.getByText('4 of 7 target chapters')).toBeInTheDocument();
    expect(screen.getByText('Buffer gap: 3')).toBeInTheDocument();
  });

  it('shows knowledge generation inclusions and source-policy exclusions', () => {
    render(<KnowledgeLibrary />);

    expect(screen.getByText('Included: Owned setting note')).toBeInTheDocument();
    expect(screen.getByText('Excluded: Sample fight cadence')).toBeInTheDocument();
    expect(screen.getByText('Reason: Source policy prohibits generation support')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run Source Check' }));
    expect(screen.getByText('Source check current')).toBeInTheDocument();
  });
});
