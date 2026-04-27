import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ManuscriptEditor } from '../components/ManuscriptEditor';
import { StoryBible } from '../components/StoryBible';

afterEach(() => {
  cleanup();
});

describe('writing workbench', () => {
  it('renders a manuscript chapter tree and editor surface', () => {
    render(<ManuscriptEditor />);

    expect(screen.getByRole('heading', { name: 'Manuscript Editor' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Chapter tree' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Chapter 12: Siege Bell' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Scene draft editor' })).toHaveTextContent(
      'The siege bell sounded under the archive city.'
    );
    expect(screen.getByText('Context inspector')).toBeInTheDocument();
    expect(screen.getByText('Canon: archive city remains airborne')).toBeInTheDocument();
  });

  it('renders story bible boards with narrative risk states', () => {
    render(<StoryBible />);

    expect(screen.getByRole('heading', { name: 'Reader Promise Board' })).toBeInTheDocument();
    expect(screen.getByText('Ready for payoff')).toBeInTheDocument();
    expect(screen.getByText('Promise: The sealed bell must answer why the city floats.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Secret Board' })).toBeInTheDocument();
    expect(screen.getByText('Reveal risk')).toBeInTheDocument();
    expect(screen.getByText('Secret: Only the archivist knows the bell is alive.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Character Arc Board' })).toBeInTheDocument();
    expect(screen.getByText('Turn needed')).toBeInTheDocument();
    expect(screen.getByText('Arc: Mira must choose trust before command.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Timeline Map' })).toBeInTheDocument();
    expect(screen.getByText('Timeline warning')).toBeInTheDocument();
    expect(screen.getByText('Warning: messenger cannot cross the lower city in 5 minutes.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'World Rule Map' })).toBeInTheDocument();
    expect(screen.getByText('Rule warning')).toBeInTheDocument();
    expect(screen.getByText('Rule: Bell magic requires a memory cost.')).toBeInTheDocument();
  });
});
