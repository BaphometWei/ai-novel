import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { KnowledgeLibrary } from '../components/KnowledgeLibrary';

afterEach(() => {
  cleanup();
});

describe('KnowledgeLibrary', () => {
  it('shows source-policy metadata for active materials and keeps restricted samples analysis-only', () => {
    render(<KnowledgeLibrary />);

    const ownedMaterial = screen.getByRole('article', { name: 'Owned setting note' });
    expect(within(ownedMaterial).getByText('WorldTemplate')).toBeInTheDocument();
    expect(within(ownedMaterial).getByText('Source: user_note')).toBeInTheDocument();
    expect(within(ownedMaterial).getByText('Allowed: generation_support')).toBeInTheDocument();
    expect(within(ownedMaterial).getByText('Prohibited: none')).toBeInTheDocument();
    expect(within(ownedMaterial).getByText('Attribution: none')).toBeInTheDocument();
    expect(within(ownedMaterial).getByText('License: owned')).toBeInTheDocument();
    expect(within(ownedMaterial).getByText('Similarity risk: Low')).toBeInTheDocument();
    expect(within(ownedMaterial).getByText('Included in generation context')).toBeInTheDocument();

    const restrictedSample = screen.getByRole('article', { name: 'Sample fight cadence' });
    expect(within(restrictedSample).getByText('Sample')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('Source: web_excerpt')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('Allowed: analysis')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('Prohibited: generation_support')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('Attribution: cite source')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('License: unknown')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('Similarity risk: High')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('Analysis-only sample')).toBeInTheDocument();
    expect(within(restrictedSample).getByText('Reason: Source policy prohibits generation support')).toBeInTheDocument();
  });

  it('keeps source-check state visible after running a check', () => {
    render(<KnowledgeLibrary />);

    fireEvent.click(screen.getByRole('button', { name: 'Run Source Check' }));

    expect(screen.getByText('Source check current')).toBeInTheDocument();
  });
});
