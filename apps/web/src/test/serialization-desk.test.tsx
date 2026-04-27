import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SerializationDesk } from '../components/SerializationDesk';

afterEach(() => {
  cleanup();
});

describe('serialization desk', () => {
  it('surfaces high-risk publish blockers by narrative category', () => {
    render(<SerializationDesk />);

    expect(screen.getByText('Publish readiness')).toBeInTheDocument();
    expect(screen.getByText('Blocked by 4 issues')).toBeInTheDocument();
    expect(screen.getByText('Reader promise: Core promise is near payoff and unresolved.')).toBeInTheDocument();
    expect(screen.getByText('Reveal: Secret reveal timing would spoil the bell mystery.')).toBeInTheDocument();
    expect(screen.getByText('Source policy: Restricted sample appears in draft.')).toBeInTheDocument();
    expect(screen.getByText('Update calendar: Buffer is below the daily cadence target.')).toBeInTheDocument();
  });

  it('updates reader feedback summary without overriding the long-term plan', () => {
    render(<SerializationDesk />);

    expect(screen.getByText('3 imported, plan preserved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import Feedback' }));

    expect(screen.getByText('4 imported, plan preserved')).toBeInTheDocument();
    expect(screen.getByText('3 pacing notes, 1 hook praise')).toBeInTheDocument();
  });
});
