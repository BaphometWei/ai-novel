import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  type ApiClient,
  type ChapterSummary,
  type CreateProjectChapterResult,
  type PreparedWritingRun,
  type WritingManuscriptApiClient,
  type WritingRunInput,
  type WritingRunResult
} from '../api/client';

const demoChapters: Array<ChapterSummary & { status: string }> = [
  { id: 'chapter_11', title: 'Chapter 11: Lower Gate', status: 'Reviewed' },
  { id: 'chapter_12', title: 'Chapter 12: Siege Bell', status: 'Drafting' },
  { id: 'chapter_13', title: 'Chapter 13: Archive Flame', status: 'Planned' }
];

const demoDraft = 'The siege bell sounded under the archive city.';

export interface ManuscriptEditorProps {
  client?: Pick<ApiClient, 'listProjects' | 'listProjectChapters' | 'getChapterCurrentBody'> & WritingManuscriptApiClient;
  projectId?: string;
}

export function ManuscriptEditor({ client, projectId: selectedProjectId }: ManuscriptEditorProps) {
  const [projectId, setProjectId] = useState<string>(selectedProjectId ?? '');
  const [chapters, setChapters] = useState<ChapterSummary[]>(client ? [] : demoChapters);
  const [selectedChapterId, setSelectedChapterId] = useState(client ? '' : 'chapter_12');
  const [run, setRun] = useState<WritingRunResult | null>(null);
  const [preparedRun, setPreparedRun] = useState<PreparedWritingRun | null>(null);
  const [status, setStatus] = useState(client ? 'Loading chapters...' : 'Drafting');
  const [acceptedVersionId, setAcceptedVersionId] = useState('');
  const [approvalReasons, setApprovalReasons] = useState<string[]>([]);
  const [draftText, setDraftText] = useState(demoDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    const resolvedClient = client;
    let mounted = true;

    async function loadChapters() {
      try {
        const currentProjectId = selectedProjectId || (await resolvedClient.listProjects())[0]?.id;
        if (!currentProjectId) {
          if (mounted) setStatus('No project available.');
          return;
        }

        const loadedChapters = await resolvedClient.listProjectChapters(currentProjectId);
        if (!mounted) return;
        setProjectId(currentProjectId);
        setChapters(loadedChapters);
        setSelectedChapterId(loadedChapters[0]?.id ?? '');
        setDraftText(demoDraft);
        setStatus(loadedChapters.length > 0 ? 'Ready' : 'No chapters yet.');
      } catch (error) {
        if (mounted) {
          setError(errorMessage(error, 'Unable to load chapters.'));
          setStatus('Unable to load chapters.');
        }
      }
    }

    void loadChapters();
    return () => {
      mounted = false;
    };
  }, [client, selectedProjectId]);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0],
    [chapters, selectedChapterId]
  );
  const canUseApi = Boolean(client && projectId && selectedChapter);

  useEffect(() => {
    if (!client || !selectedChapter?.id || run) return;
    const resolvedClient = client;
    const chapterId = selectedChapter.id;
    let mounted = true;

    async function loadCurrentBody() {
      try {
        const currentBody = await resolvedClient.getChapterCurrentBody(chapterId);
        if (!mounted || selectedChapterId !== chapterId) return;
        if (currentBody) {
          setDraftText(currentBody.body);
        }
      } catch (caught) {
        if (mounted) {
          setError(errorMessage(caught, 'Unable to load chapter body.'));
        }
      }
    }

    void loadCurrentBody();
    return () => {
      mounted = false;
    };
  }, [client, run, selectedChapter?.id, selectedChapterId]);

  async function createChapter() {
    if (!client || !projectId) return;
    setStatus('Creating chapter...');
    setError(null);
    try {
      const result: CreateProjectChapterResult = await client.createProjectChapter(projectId, {
        title: 'New working chapter',
        order: chapters.length + 1,
        body: 'New chapter draft.',
        status: 'Draft'
      });
      setChapters((current) => [...current, result.chapter]);
      setSelectedChapterId(result.chapter.id);
      setRun(null);
      setPreparedRun(null);
      setDraftText('New chapter draft.');
      setAcceptedVersionId('');
      setApprovalReasons([]);
      setStatus('Ready');
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to create chapter.'));
      setStatus(chapters.length > 0 ? 'Ready' : 'No chapters yet.');
    }
  }

  async function generateDraft() {
    if (!client || !projectId || !selectedChapter) return;
    setStatus('Generating draft...');
    setError(null);
    setAcceptedVersionId('');
    setApprovalReasons([]);
    try {
      setPreparedRun(null);
      const result = await client.startWritingRun(projectId, writingRunInputFor(selectedChapter));
      setRun(result);
      setDraftText(result.draftArtifact.text);
      setStatus(result.status);
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to generate draft.'));
      setStatus('Ready');
    }
  }

  async function inspectBeforeSend() {
    if (!client || !projectId || !selectedChapter) return;
    setStatus('Preparing send...');
    setError(null);
    setAcceptedVersionId('');
    setApprovalReasons([]);
    try {
      const prepared = await client.prepareWritingRun(projectId, writingRunInputFor(selectedChapter));
      setPreparedRun(prepared);
      setRun(null);
      setStatus(prepared.status);
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to prepare writing run.'));
      setStatus('Ready');
    }
  }

  async function confirmPreparedSend() {
    if (!client || !projectId || !preparedRun) return;
    setStatus('Executing prepared send...');
    setError(null);
    try {
      const result = await client.executePreparedWritingRun(projectId, preparedRun.id, {
        confirmed: true,
        confirmedBy: 'operator'
      });
      setRun(result);
      setPreparedRun(null);
      setDraftText(result.draftArtifact.text);
      setStatus(result.status);
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to execute prepared send.'));
      setStatus(preparedRun.status);
    }
  }

  async function cancelPreparedSend() {
    if (!client || !projectId || !preparedRun) return;
    setStatus('Cancelling prepared send...');
    setError(null);
    try {
      await client.cancelPreparedWritingRun(projectId, preparedRun.id, { cancelledBy: 'operator' });
      setPreparedRun(null);
      setStatus('Prepared send cancelled.');
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to cancel prepared send.'));
      setStatus(preparedRun.status);
    }
  }

  async function acceptDraft() {
    if (!client || !selectedChapter || !run) return;
    setStatus('Accepting draft...');
    setError(null);
    try {
      const result = await client.acceptDraft(selectedChapter.id, {
        runId: run.id,
        draftArtifactId: run.draftArtifact.artifactRecordId ?? run.draftArtifact.id,
        body: draftText,
        acceptedBy: 'operator'
      });
      setAcceptedVersionId(result.versionId);
      setApprovalReasons(result.approvals.map((approval) => approval.reason).filter(Boolean));
      setStatus(result.status);
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to accept draft.'));
      setStatus(run.status || 'Ready');
    }
  }

  function updateDraftText(event: FormEvent<HTMLDivElement>) {
    setDraftText(event.currentTarget.textContent ?? '');
  }

  return (
    <section className="editor-panel" id="manuscript" aria-labelledby="manuscript-editor-title">
      <header className="panel-header">
        <h2 id="manuscript-editor-title">Manuscript Editor</h2>
        <span>{status}</span>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <div className="manuscript-layout">
        <aside className="chapter-tree" aria-label="Chapter tree" role="tree">
          {client ? (
            <button className="chapter-node" type="button" onClick={() => void createChapter()} disabled={!projectId}>
              New chapter
            </button>
          ) : null}
          {chapters.map((chapter) => (
            <button
              aria-label={chapter.title}
              aria-selected={chapter.id === selectedChapter?.id}
              className="chapter-node"
              key={chapter.id}
              onClick={() => {
                setSelectedChapterId(chapter.id);
                setRun(null);
                setPreparedRun(null);
                setDraftText(demoDraft);
                setAcceptedVersionId('');
                setApprovalReasons([]);
                setError(null);
              }}
              role="treeitem"
              type="button"
            >
              <span>{chapter.title}</span>
              <small>{chapterStatus(chapter)}</small>
            </button>
          ))}
        </aside>
        <article className="draft-surface">
          {client ? (
            <div>
              <button type="button" onClick={() => void generateDraft()} disabled={!canUseApi}>
                Generate draft
              </button>
              <button type="button" onClick={() => void inspectBeforeSend()} disabled={!canUseApi}>
                Inspect before send
              </button>
              <button
                type="button"
                onClick={() => void confirmPreparedSend()}
                disabled={!preparedRun || preparedRun.blockingReasons.length > 0}
              >
                Confirm send
              </button>
              <button type="button" onClick={() => void cancelPreparedSend()} disabled={!preparedRun}>
                Cancel prepared send
              </button>
              <button type="button" onClick={() => void acceptDraft()} disabled={!run}>
                Accept draft into manuscript
              </button>
            </div>
          ) : null}
          <div
            aria-label="Scene draft editor"
            className="draft-editor"
            contentEditable
            onInput={updateDraftText}
            role="textbox"
            suppressContentEditableWarning
          >
            {draftText}
          </div>
          {acceptedVersionId ? (
            <p>{approvalReasons.length > 0 ? `Pending approval for ${acceptedVersionId}.` : `Accepted as ${acceptedVersionId}.`}</p>
          ) : null}
          {approvalReasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          {preparedRun ? (
            <section aria-label="Pre-send inspection" className="context-inspector">
              <h3>Pre-send inspection</h3>
              <dl className="compact-list">
                <div>
                  <dt>Provider</dt>
                  <dd>
                    {preparedRun.provider.provider} / {preparedRun.provider.model}
                  </dd>
                </div>
                <div>
                  <dt>Context pack</dt>
                  <dd>{preparedRun.contextPack.id}</dd>
                </div>
                <div>
                  <dt>Budget estimate</dt>
                  <dd>
                    {preparedRun.budgetEstimate.inputTokens} input / {preparedRun.budgetEstimate.outputTokens} output / $
                    {preparedRun.budgetEstimate.estimatedCostUsd.toFixed(4)}
                  </dd>
                </div>
                {preparedRun.contextPack.sections.map((section) => (
                  <div key={section.name}>
                    <dt>{section.name}</dt>
                    <dd>{section.content}</dd>
                  </div>
                ))}
                {preparedRun.contextPack.citations.map((citation) => (
                  <div key={`${citation.sourceId}-${citation.quote ?? ''}`}>
                    <dt>Evidence</dt>
                    <dd>{citation.quote ?? citation.sourceId}</dd>
                  </div>
                ))}
                {preparedRun.contextPack.exclusions.map((exclusion) => (
                  <div key={exclusion}>
                    <dt>Excluded</dt>
                    <dd>{exclusion}</dd>
                  </div>
                ))}
                {[...preparedRun.warnings, ...preparedRun.contextPack.warnings].map((warning) => (
                  <div key={warning}>
                    <dt>Warning</dt>
                    <dd>{warning}</dd>
                  </div>
                ))}
                {preparedRun.blockingReasons.map((reason) => (
                  <div key={reason}>
                    <dt>Blocked</dt>
                    <dd>{reason}</dd>
                  </div>
                ))}
                {preparedRun.contextPack.retrievalTrace.map((trace) => (
                  <div key={trace}>
                    <dt>Retrieval</dt>
                    <dd>{trace}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          <dl className="compact-list context-inspector">
            <div>
              <dt>Context inspector</dt>
              <dd>{run?.contextPack.sections[0]?.content ?? 'Canon: archive city remains airborne'}</dd>
            </div>
            <div>
              <dt>Reader promise</dt>
              <dd>{run?.selfCheckArtifact.result.summary ?? 'Sealed bell mystery is ready for payoff'}</dd>
            </div>
            <div>
              <dt>Risk gate</dt>
              <dd>{run?.contextPack.warnings[0] ?? 'Medium risk, author review required before canon change'}</dd>
            </div>
            {run?.selfCheckArtifact.result.findings.map((finding) => (
              <div key={finding}>
                <dt>Self-check</dt>
                <dd>{finding}</dd>
              </div>
            ))}
            {run?.contextPack.citations.map((citation) => (
              <div key={`${citation.sourceId}-${citation.quote ?? ''}`}>
                <dt>Evidence</dt>
                <dd>{citation.quote ?? citation.sourceId}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}

function writingRunInputFor(chapter: ChapterSummary): WritingRunInput {
  return {
    target: {
      manuscriptId: chapter.manuscriptId ?? 'manuscript_default',
      chapterId: chapter.id,
      range: chapter.title
    },
    contract: {
      authorshipLevel: 'A3',
      goal: `Draft ${chapter.title}`,
      mustWrite: `Draft the selected chapter: ${chapter.title}.`,
      wordRange: { min: 300, max: 900 },
      forbiddenChanges: ['Do not change canon without review'],
      acceptanceCriteria: ['Ready for author acceptance']
    },
    retrieval: {
      query: chapter.title,
      maxContextItems: 4,
      maxSectionChars: 1200
    }
  };
}

function chapterStatus(chapter: ChapterSummary & { status?: string }) {
  if (chapter.status) return chapter.status;
  const currentVersion = chapter.versions?.find((version) => version.id === chapter.currentVersionId);
  return currentVersion?.status ?? 'Draft';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
