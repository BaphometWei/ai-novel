import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

describe('App', () => {
  it('renders the writing cockpit dashboard', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'AI Novel Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Decision Queue')).toBeInTheDocument();
    expect(screen.getByText('Current Project')).toBeInTheDocument();
  });
});
