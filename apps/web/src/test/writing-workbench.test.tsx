import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManuscriptEditor } from '../components/ManuscriptEditor';
import { StoryBible } from '../components/StoryBible';

afterEach(() => {
  cleanup();
});

describe('writing workbench', () => {
  it('runs a writing draft for a selected API chapter and accepts it into the manuscript', async () => {
    const client = {
      listProjects: vi.fn(async () => [{ id: 'project_api', title: 'API Project' }]),
      listProjectChapters: vi.fn(async () => [
        {
          id: 'chapter_api_1',
          title: 'Opening',
          manuscriptId: 'manuscript_api',
          currentVersionId: 'version_1',
          versions: []
        },
        {
          id: 'chapter_api_2',
          title: 'Clocktower',
          manuscriptId: 'manuscript_api',
          currentVersionId: 'version_2',
          versions: []
        }
      ]),
      getChapterCurrentBody: vi.fn(async () => null),
      createProjectChapter: vi.fn(),
      startWritingRun: vi.fn(async () => ({
        id: 'agent_run_1',
        status: 'AwaitingAcceptance',
        manuscriptVersionId: null,
        draftArtifact: {
          id: 'artifact_draft_1',
          type: 'draft_prose',
          status: 'Draft',
          text: 'Mara waited under the clocktower until the courier arrived.',
          contextPackId: 'context_pack_1'
        },
        selfCheckArtifact: {
          id: 'artifact_check_1',
          type: 'self_check',
          status: 'Completed',
          result: {
            summary: 'The draft follows the contract.',
            passed: true,
            findings: ['Keep courier identity hidden.']
          }
        },
        contextPack: {
          id: 'context_pack_1',
          taskGoal: 'Draft Clocktower',
          agentRole: 'Writer',
          riskLevel: 'Medium',
          sections: [{ name: 'canon', content: 'Mara fears bells.' }],
          citations: [{ sourceId: 'canon_1', quote: 'Mara fears bells.' }],
          exclusions: [],
          warnings: ['Canon candidate requires author review.'],
          retrievalTrace: ['query:Mara courier clocktower'],
          createdAt: '2026-04-27T00:00:00.000Z'
        },
        review: {
          status: 'Completed',
          requiresAuthorAcceptance: true,
          artifactId: 'artifact_check_1'
        },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft Clocktower',
          mustWrite: 'Draft the selected chapter.',
          wordRange: { min: 300, max: 900 },
          forbiddenChanges: ['Do not change canon without review'],
          acceptanceCriteria: ['Ready for author acceptance']
        }
      })),
      addChapterVersion: vi.fn(async () => ({
        id: 'version_accepted',
        chapterId: 'chapter_api_2',
        versionNumber: 3,
        bodyArtifactId: 'artifact_accepted',
        status: 'Accepted'
      }))
    };

    render(<ManuscriptEditor client={client} />);

    expect(await screen.findByRole('treeitem', { name: 'Opening' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('treeitem', { name: 'Clocktower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate draft' }));

    expect(await screen.findByText('Mara waited under the clocktower until the courier arrived.')).toBeInTheDocument();
    expect(screen.getByText('The draft follows the contract.')).toBeInTheDocument();
    expect(screen.getAllByText('Mara fears bells.').length).toBeGreaterThan(0);
    expect(screen.getByText('Canon candidate requires author review.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept draft into manuscript' }));

    await waitFor(() => {
      expect(client.addChapterVersion).toHaveBeenCalledWith('chapter_api_2', {
        body: 'Mara waited under the clocktower until the courier arrived.',
        status: 'Accepted',
        makeCurrent: true,
        metadata: {
          acceptedFromRunId: 'agent_run_1',
          draftArtifactId: 'artifact_draft_1'
        }
      });
    });
    expect(screen.getByText('Accepted as version_accepted.')).toBeInTheDocument();
  });

  it('accepts the edited draft text shown in the editor', async () => {
    const client = createWritingClient({
      startWritingRun: vi.fn(async () => writingRunResult()),
      addChapterVersion: vi.fn(async () => ({
        id: 'version_accepted',
        chapterId: 'chapter_api_1',
        versionNumber: 2,
        bodyArtifactId: 'artifact_accepted',
        status: 'Accepted'
      }))
    });

    render(<ManuscriptEditor client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Generate draft' }));
    const editor = await screen.findByRole('textbox', { name: 'Scene draft editor' });
    fireEvent.input(editor, {
      currentTarget: { textContent: 'Author-polished clocktower draft.' },
      target: { textContent: 'Author-polished clocktower draft.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept draft into manuscript' }));

    await waitFor(() => {
      expect(client.addChapterVersion).toHaveBeenCalledWith(
        'chapter_api_1',
        expect.objectContaining({
          body: 'Author-polished clocktower draft.',
          status: 'Accepted',
          makeCurrent: true
        })
      );
    });
  });

  it('loads the current body for an existing API chapter', async () => {
    const client = createWritingClient({
      getChapterCurrentBody: vi.fn(async (chapterId: string) => ({
        chapterId,
        versionId: 'version_1',
        body: 'Existing persisted opening body.'
      }))
    });

    render(<ManuscriptEditor client={client} />);

    expect(await screen.findByRole('textbox', { name: 'Scene draft editor' })).toHaveTextContent(
      'Existing persisted opening body.'
    );
    expect(client.getChapterCurrentBody).toHaveBeenCalledWith('chapter_api_1');
  });

  it('shows API action errors and leaves controls usable', async () => {
    const client = createWritingClient({
      startWritingRun: vi.fn(async () => {
        throw new Error('Writing run failed with 404');
      })
    });

    render(<ManuscriptEditor client={client} />);

    const generateButton = await screen.findByRole('button', { name: 'Generate draft' });
    fireEvent.click(generateButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Writing run failed with 404');
    expect(generateButton).toBeEnabled();
  });

  it('creates a chapter through the manuscript API and selects it', async () => {
    const client = {
      listProjects: vi.fn(async () => [{ id: 'project_api', title: 'API Project' }]),
      listProjectChapters: vi.fn(async () => []),
      getChapterCurrentBody: vi.fn(async () => null),
      createProjectChapter: vi.fn(async () => ({
        chapter: {
          id: 'chapter_new',
          title: 'New working chapter',
          manuscriptId: 'manuscript_api',
          currentVersionId: 'version_new',
          versions: []
        },
        version: {
          id: 'version_new',
          chapterId: 'chapter_new',
          versionNumber: 1,
          bodyArtifactId: 'artifact_new',
          status: 'Draft'
        }
      })),
      startWritingRun: vi.fn(),
      addChapterVersion: vi.fn()
    };

    render(<ManuscriptEditor client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'New chapter' }));

    expect(await screen.findByRole('treeitem', { name: 'New working chapter' })).toHaveAttribute('aria-selected', 'true');
    expect(client.createProjectChapter).toHaveBeenCalledWith('project_api', {
      title: 'New working chapter',
      order: 1,
      body: 'New chapter draft.',
      status: 'Draft'
    });
  });

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

function createWritingClient(overrides: Record<string, unknown> = {}) {
  return {
    listProjects: vi.fn(async () => [{ id: 'project_api', title: 'API Project' }]),
    listProjectChapters: vi.fn(async () => [
      {
        id: 'chapter_api_1',
        title: 'Opening',
        manuscriptId: 'manuscript_api',
        currentVersionId: 'version_1',
        versions: []
      }
    ]),
    createProjectChapter: vi.fn(),
    getChapterCurrentBody: vi.fn(async () => null),
    startWritingRun: vi.fn(async () => writingRunResult()),
    addChapterVersion: vi.fn(async () => ({
      id: 'version_accepted',
      chapterId: 'chapter_api_1',
      versionNumber: 2,
      bodyArtifactId: 'artifact_accepted',
      status: 'Accepted'
    })),
    ...overrides
  };
}

function writingRunResult() {
  return {
    id: 'agent_run_1',
    status: 'AwaitingAcceptance',
    manuscriptVersionId: null,
    draftArtifact: {
      id: 'artifact_draft_1',
      type: 'draft_prose',
      status: 'Draft',
      text: 'Mara waited under the clocktower until the courier arrived.',
      contextPackId: 'context_pack_1'
    },
    selfCheckArtifact: {
      id: 'artifact_check_1',
      type: 'self_check',
      status: 'Completed',
      result: {
        summary: 'The draft follows the contract.',
        passed: true,
        findings: ['Keep courier identity hidden.']
      }
    },
    contextPack: {
      id: 'context_pack_1',
      taskGoal: 'Draft Opening',
      agentRole: 'Writer',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'Mara fears bells.' }],
      citations: [{ sourceId: 'canon_1', quote: 'Mara fears bells.' }],
      exclusions: [],
      warnings: ['Canon candidate requires author review.'],
      retrievalTrace: ['query:Mara courier clocktower'],
      createdAt: '2026-04-27T00:00:00.000Z'
    }
  };
}
