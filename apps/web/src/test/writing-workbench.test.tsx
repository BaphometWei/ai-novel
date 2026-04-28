import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, PreparedWritingRun, WritingManuscriptApiClient, WritingRunResult } from '../api/client';
import { ManuscriptEditor } from '../components/ManuscriptEditor';
import { StoryBible } from '../components/StoryBible';

afterEach(() => {
  cleanup();
});

describe('writing workbench', () => {
  it('runs a writing draft for a selected API chapter and accepts it into the manuscript', async () => {
    const client = createWritingClient({
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
      startWritingRun: vi.fn(async () => ({
        id: 'agent_run_1',
        status: 'AwaitingAcceptance',
        manuscriptVersionId: null,
        draftArtifact: {
          id: 'workflow_draft_1',
          artifactRecordId: 'artifact_draft_record_1',
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
      addChapterVersion: vi.fn(),
      acceptDraft: vi.fn(async () => ({
        status: 'PendingApproval' as const,
        projectId: 'project_api',
        chapterId: 'chapter_api_2',
        versionId: 'version_pending',
        sourceRunId: 'agent_run_1',
        draftArtifactId: 'artifact_draft_record_1',
        approvals: [
          {
            id: 'approval_memory_1',
            targetType: 'memory_candidate_fact',
            targetId: 'memory_candidate_1',
            status: 'Pending',
            riskLevel: 'High' as const,
            reason: 'Memory candidate requires approval'
          }
        ],
        candidates: []
      }))
    });

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
      expect(client.acceptDraft).toHaveBeenCalledWith('chapter_api_2', {
        runId: 'agent_run_1',
        draftArtifactId: 'artifact_draft_record_1',
        body: 'Mara waited under the clocktower until the courier arrived.',
        acceptedBy: 'operator'
      });
    });
    expect(screen.getByText('Pending approval for version_pending.')).toBeInTheDocument();
    expect(screen.getByText('Memory candidate requires approval')).toBeInTheDocument();
  });

  it('accepts the edited draft text shown in the editor', async () => {
    const client = createWritingClient({
      startWritingRun: vi.fn(async () => writingRunResult()),
      acceptDraft: vi.fn(async () => ({
        status: 'Accepted' as const,
        projectId: 'project_api',
        chapterId: 'chapter_api_1',
        versionId: 'version_accepted',
        sourceRunId: 'agent_run_1',
        draftArtifactId: 'artifact_draft_1',
        approvals: [],
        candidates: []
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
      expect(client.acceptDraft).toHaveBeenCalledWith(
        'chapter_api_1',
        expect.objectContaining({
          body: 'Author-polished clocktower draft.',
          acceptedBy: 'operator'
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

  it('prepares an inspectable send before executing a writing run', async () => {
    const client = createWritingClient({
      prepareWritingRun: vi.fn(async () => preparedWritingRunResult()),
      executePreparedWritingRun: vi.fn(async () => writingRunResult()),
      cancelPreparedWritingRun: vi.fn(async () => ({ ...preparedWritingRunResult(), status: 'Cancelled' as const }))
    });

    render(<ManuscriptEditor client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Inspect before send' }));

    expect(await screen.findByLabelText('Pre-send inspection')).toHaveTextContent('openai');
    expect(screen.getByLabelText('Pre-send inspection')).toHaveTextContent('gpt-test');
    expect(screen.getByLabelText('Pre-send inspection')).toHaveTextContent('125 input');
    expect(screen.getByLabelText('Pre-send inspection')).toHaveTextContent('Mara fears bells.');
    expect(screen.getByLabelText('Pre-send inspection')).toHaveTextContent('restricted_source_1');
    expect(screen.getByLabelText('Pre-send inspection')).toHaveTextContent('External model call requires pre-send confirmation');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm send' }));

    await waitFor(() => {
      expect(client.executePreparedWritingRun).toHaveBeenCalledWith('project_api', 'job_prepared_1', {
        confirmed: true,
        confirmedBy: 'operator'
      });
    });
    expect(await screen.findByText('Mara waited under the clocktower until the courier arrived.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect before send' }));
    await screen.findByLabelText('Pre-send inspection');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel prepared send' }));
    await waitFor(() => {
      expect(client.cancelPreparedWritingRun).toHaveBeenCalledWith('project_api', 'job_prepared_1', {
        cancelledBy: 'operator'
      });
    });
    expect(screen.queryByLabelText('Pre-send inspection')).not.toBeInTheDocument();
  });

  it('loads chapters for the selected project passed by the app shell', async () => {
    const client = createWritingClient({
      listProjects: vi.fn(async () => [{ id: 'project_fallback', title: 'Fallback Project' }]),
      listProjectChapters: vi.fn(async () => [
        {
          id: 'chapter_selected_1',
          title: 'Selected Project Chapter',
          manuscriptId: 'manuscript_selected',
          currentVersionId: 'version_selected_1',
          versions: []
        }
      ])
    });

    render(<ManuscriptEditor client={client} projectId="project_selected" />);

    expect(await screen.findByRole('treeitem', { name: 'Selected Project Chapter' })).toBeInTheDocument();
    expect(client.listProjects).not.toHaveBeenCalled();
    expect(client.listProjectChapters).toHaveBeenCalledWith('project_selected');
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
    const client = createWritingClient({
      listProjectChapters: vi.fn(async () => []),
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
      }))
    });

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

  it('disables chapter creation until an API project is loaded', async () => {
    let resolveProjects: (projects: Array<{ id: string; title: string }>) => void = () => undefined;
    const projectsPromise = new Promise<Array<{ id: string; title: string }>>((resolve) => {
      resolveProjects = resolve;
    });
    const client = createWritingClient({
      listProjects: vi.fn(async () => projectsPromise),
      listProjectChapters: vi.fn(async () => [])
    });

    render(<ManuscriptEditor client={client} />);

    const createButton = screen.getByRole('button', { name: 'New chapter' });
    expect(createButton).toBeDisabled();

    resolveProjects([{ id: 'project_api', title: 'API Project' }]);
    await waitFor(() => expect(createButton).toBeEnabled());
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

type WritingClientFixture = Pick<ApiClient, 'listProjects' | 'listProjectChapters' | 'getChapterCurrentBody'> &
  WritingManuscriptApiClient;

function createWritingClient(overrides: Partial<WritingClientFixture> = {}): WritingClientFixture {
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
    prepareWritingRun: vi.fn(async () => preparedWritingRunResult()),
    executePreparedWritingRun: vi.fn(async () => writingRunResult()),
    cancelPreparedWritingRun: vi.fn(async () => ({ ...preparedWritingRunResult(), status: 'Cancelled' as const })),
    addChapterVersion: vi.fn(async () => ({
      id: 'version_accepted',
      chapterId: 'chapter_api_1',
      versionNumber: 2,
      bodyArtifactId: 'artifact_accepted',
      status: 'Accepted'
    })),
    acceptDraft: vi.fn(async () => ({
      status: 'Accepted' as const,
      projectId: 'project_api',
      chapterId: 'chapter_api_1',
      versionId: 'version_accepted',
      sourceRunId: 'agent_run_1',
      draftArtifactId: 'artifact_draft_1',
      approvals: [],
      candidates: []
    })),
    ...overrides
  };
}

function writingRunResult(): WritingRunResult {
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

function preparedWritingRunResult(): PreparedWritingRun {
  return {
    id: 'job_prepared_1',
    projectId: 'project_api',
    agentRunId: 'agent_run_prepared_1',
    status: 'Prepared',
    confirmationRequired: true,
    provider: {
      provider: 'openai',
      model: 'gpt-test',
      isExternal: true,
      secretConfigured: true
    },
    budgetEstimate: {
      inputTokens: 125,
      outputTokens: 1024,
      estimatedCostUsd: 0.0012,
      maxRunCostUsd: 0.25
    },
    warnings: ['External model call requires pre-send confirmation'],
    blockingReasons: [],
    expiresAt: '2026-04-28T01:00:00.000Z',
    contextPack: {
      id: 'context_pack_prepared',
      taskGoal: 'Draft Opening',
      agentRole: 'Writer',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'Mara fears bells.' }],
      citations: [{ sourceId: 'canon_1', quote: 'Mara fears bells.' }],
      exclusions: ['restricted_source_1'],
      warnings: ['Restricted source omitted.'],
      retrievalTrace: ['query:Opening'],
      createdAt: '2026-04-28T00:00:00.000Z'
    }
  };
}
