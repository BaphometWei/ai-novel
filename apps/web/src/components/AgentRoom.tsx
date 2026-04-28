import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type AgentOrchestrationRunResult,
  type ApiClient,
  type AgentRoomApiClient,
  type AgentRoomActionResult,
  type AgentRoomRunDetail,
  type AgentRoomRunSummary,
  type OrchestrationApiClient,
  type OrchestrationRunInput,
  type PreparedAgentOrchestrationRun
} from '../api/client';
import { ContextInspector } from './ContextInspector';
import { RunGraph } from './RunGraph';

type AgentRoomState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | {
      status: 'loaded';
      runs: AgentRoomRunSummary[];
      selectedRunId: string;
      detail: AgentRoomRunDetail | null;
      detailLoading: boolean;
      actionRunning: string | null;
      actionResult: AgentRoomActionResult | null;
      actionError: string | null;
    };

type AgentRoomClient = AgentRoomApiClient & Partial<Pick<ApiClient, 'listProjects'> & OrchestrationApiClient>;

export interface AgentRoomProps {
  client?: AgentRoomClient;
}

export function AgentRoom({ client }: AgentRoomProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [state, setState] = useState<AgentRoomState>({ status: 'loading' });
  const [projectId, setProjectId] = useState('');
  const [preparedOrchestration, setPreparedOrchestration] = useState<PreparedAgentOrchestrationRun | null>(null);
  const [orchestrationResult, setOrchestrationResult] = useState<AgentOrchestrationRunResult | null>(null);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);
  const [orchestrationBusy, setOrchestrationBusy] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRuns() {
      try {
        const runs = await resolvedClient.listAgentRoomRuns();
        if (!isMounted) return;
        if (runs.length === 0) {
          setState({ status: 'empty' });
          return;
        }

        setState({
          status: 'loaded',
          runs,
          selectedRunId: runs[0].id,
          detail: null,
          detailLoading: true,
          actionRunning: null,
          actionResult: null,
          actionError: null
        });
        const detail = await resolvedClient.getAgentRoomRun(runs[0].id);
        if (isMounted) {
          setState({
            status: 'loaded',
            runs,
            selectedRunId: runs[0].id,
            detail,
            detailLoading: false,
            actionRunning: null,
            actionResult: null,
            actionError: null
          });
        }
      } catch (error) {
        if (isMounted) {
          setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load agent room' });
        }
      }
    }

    void loadRuns();

    return () => {
      isMounted = false;
    };
  }, [resolvedClient]);

  useEffect(() => {
    if (!canLoadProjects(resolvedClient) || !canPrepareOrchestration(resolvedClient)) return;
    const orchestrationClient = resolvedClient;
    let isMounted = true;

    async function loadProject() {
      try {
        const projects = await orchestrationClient.listProjects();
        if (isMounted) {
          setProjectId(projects[0]?.id ?? '');
        }
      } catch {
        if (isMounted) {
          setProjectId('');
        }
      }
    }

    void loadProject();
    return () => {
      isMounted = false;
    };
  }, [resolvedClient]);

  async function currentProjectId(): Promise<string> {
    if (projectId) return projectId;
    if (!canLoadProjects(resolvedClient)) return '';
    const projects = await resolvedClient.listProjects();
    const nextProjectId = projects[0]?.id ?? '';
    setProjectId(nextProjectId);
    return nextProjectId;
  }

  async function inspectOrchestrationSend() {
    if (!canPrepareOrchestration(resolvedClient)) return;
    setOrchestrationBusy('prepare');
    setOrchestrationError(null);
    setOrchestrationResult(null);
    try {
      const resolvedProjectId = await currentProjectId();
      if (!resolvedProjectId) throw new Error('No project available.');
      const prepared = await resolvedClient.prepareOrchestrationRun(orchestrationRunInputFor(resolvedProjectId));
      setPreparedOrchestration(prepared);
    } catch (error) {
      setOrchestrationError(error instanceof Error ? error.message : 'Unable to prepare orchestration send.');
    } finally {
      setOrchestrationBusy(null);
    }
  }

  async function confirmOrchestrationSend() {
    if (!preparedOrchestration || !canPrepareOrchestration(resolvedClient)) return;
    setOrchestrationBusy('execute');
    setOrchestrationError(null);
    try {
      const result = await resolvedClient.executePreparedOrchestrationRun(preparedOrchestration.id, {
        confirmed: true,
        confirmedBy: 'operator'
      });
      setOrchestrationResult(result);
      setPreparedOrchestration(null);
    } catch (error) {
      setOrchestrationError(error instanceof Error ? error.message : 'Unable to execute orchestration send.');
    } finally {
      setOrchestrationBusy(null);
    }
  }

  async function cancelOrchestrationSend() {
    if (!preparedOrchestration || !canPrepareOrchestration(resolvedClient)) return;
    setOrchestrationBusy('cancel');
    setOrchestrationError(null);
    try {
      await resolvedClient.cancelPreparedOrchestrationRun(preparedOrchestration.id, { cancelledBy: 'operator' });
      setPreparedOrchestration(null);
    } catch (error) {
      setOrchestrationError(error instanceof Error ? error.message : 'Unable to cancel orchestration send.');
    } finally {
      setOrchestrationBusy(null);
    }
  }

  async function selectRun(runId: string) {
    if (state.status !== 'loaded') return;
    const runs = state.runs;
    setState({ ...state, selectedRunId: runId, detailLoading: true, actionResult: null, actionError: null });
    try {
      const detail = await resolvedClient.getAgentRoomRun(runId);
      setState({
        status: 'loaded',
        runs,
        selectedRunId: runId,
        detail,
        detailLoading: false,
        actionRunning: null,
        actionResult: null,
        actionError: null
      });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load run detail' });
    }
  }

  async function runAction(action: string) {
    if (state.status !== 'loaded' || state.detailLoading) return;
    const { runs, selectedRunId, detail } = state;
    setState({ ...state, actionRunning: action, actionResult: null, actionError: null });
    try {
      const actionResult = await resolvedClient.runAgentRoomAction(selectedRunId, action);
      setState({
        status: 'loaded',
        runs,
        selectedRunId,
        detail,
        detailLoading: false,
        actionRunning: null,
        actionResult,
        actionError: null
      });
    } catch (error) {
      setState({
        status: 'loaded',
        runs,
        selectedRunId,
        detail,
        detailLoading: false,
        actionRunning: null,
        actionResult: null,
        actionError: error instanceof Error ? error.message : `Unable to ${action} run`
      });
    }
  }

  return (
    <section className="surface-panel" id="agent-room" aria-labelledby="agent-room-title">
      <header className="workspace-header">
        <p>Agent Room</p>
        <h2 id="agent-room-title">Run Inspector</h2>
      </header>

      {state.status === 'loading' ? <p>Loading agent runs...</p> : null}
      {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
      {state.status === 'empty' ? <p>No agent runs yet.</p> : null}

      {state.status === 'loaded' ? (
        <div className="workspace-grid">
          <section className="work-surface" aria-label="Agent runs">
            {state.runs.map((run) => (
              <button
                aria-selected={run.id === state.selectedRunId}
                key={run.id}
                onClick={() => void selectRun(run.id)}
                type="button"
              >
                {run.agentName} {run.taskType} {run.status}
              </button>
            ))}
          </section>

          <section className="work-surface" aria-label="Agent run detail">
            {state.detailLoading ? <p>Loading run detail...</p> : null}
            {state.detail ? (
              <>
                <AgentRunDetail
                  actionError={state.actionError}
                  actionResult={state.actionResult}
                  actionRunning={state.actionRunning}
                  detail={state.detail}
                  onRunAction={runAction}
                />
                {canPrepareOrchestration(resolvedClient) ? (
                  <OrchestrationPreSendControls
                    busy={orchestrationBusy}
                    error={orchestrationError}
                    onCancel={() => void cancelOrchestrationSend()}
                    onConfirm={() => void confirmOrchestrationSend()}
                    onInspect={() => void inspectOrchestrationSend()}
                    prepared={preparedOrchestration}
                    result={orchestrationResult}
                  />
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function canLoadProjects(client: AgentRoomClient): client is AgentRoomClient & Pick<ApiClient, 'listProjects'> {
  return typeof client.listProjects === 'function';
}

function canPrepareOrchestration(client: AgentRoomClient): client is AgentRoomClient & OrchestrationApiClient {
  return (
    typeof client.prepareOrchestrationRun === 'function' &&
    typeof client.executePreparedOrchestrationRun === 'function' &&
    typeof client.cancelPreparedOrchestrationRun === 'function'
  );
}

function orchestrationRunInputFor(projectId: string): OrchestrationRunInput {
  return {
    projectId,
    workflowType: 'chapter_creation',
    taskType: 'chapter_planning',
    agentRole: 'Planner',
    taskGoal: 'Plan the next inspected chapter',
    riskLevel: 'Medium',
    outputSchema: 'ChapterPlan',
    promptVersionId: 'prompt_chapter_plan_v1',
    retrieval: {
      query: 'next inspected chapter',
      maxContextItems: 4,
      maxSectionChars: 1200
    }
  };
}

function OrchestrationPreSendControls({
  busy,
  error,
  onCancel,
  onConfirm,
  onInspect,
  prepared,
  result
}: {
  busy: string | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onInspect: () => void;
  prepared: PreparedAgentOrchestrationRun | null;
  result: AgentOrchestrationRunResult | null;
}) {
  return (
    <section aria-label="Orchestration send controls">
      <h4>Orchestration Send</h4>
      <div>
        <button disabled={busy !== null} onClick={onInspect} type="button">
          Inspect orchestration send
        </button>
        <button
          disabled={!prepared || prepared.blockingReasons.length > 0 || busy !== null}
          onClick={onConfirm}
          type="button"
        >
          Confirm orchestration send
        </button>
        <button disabled={!prepared || busy !== null} onClick={onCancel} type="button">
          Cancel orchestration send
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {prepared ? <OrchestrationInspection prepared={prepared} /> : null}
      {result ? (
        <pre aria-label="Orchestration execution result">{JSON.stringify(result.output, null, 2)}</pre>
      ) : null}
    </section>
  );
}

function OrchestrationInspection({ prepared }: { prepared: PreparedAgentOrchestrationRun }) {
  return (
    <section aria-label="Orchestration pre-send inspection" className="context-inspector">
      <h4>Pre-send inspection</h4>
      <dl className="compact-list">
        <div>
          <dt>Provider</dt>
          <dd>
            {prepared.provider.provider} / {prepared.provider.model}
          </dd>
        </div>
        <div>
          <dt>Context pack</dt>
          <dd>{prepared.contextPack.id}</dd>
        </div>
        <div>
          <dt>Budget estimate</dt>
          <dd>
            {prepared.budgetEstimate.inputTokens} input / {prepared.budgetEstimate.outputTokens} output / $
            {prepared.budgetEstimate.estimatedCostUsd.toFixed(4)}
          </dd>
        </div>
        {prepared.contextPack.sections.map((section) => (
          <div key={section.name}>
            <dt>{section.name}</dt>
            <dd>{section.content}</dd>
          </div>
        ))}
        {prepared.contextPack.citations.map((citation) => (
          <div key={`${citation.sourceId}-${citation.quote ?? ''}`}>
            <dt>Evidence</dt>
            <dd>{citation.quote ?? citation.sourceId}</dd>
          </div>
        ))}
        {prepared.contextPack.exclusions.map((exclusion) => (
          <div key={exclusion}>
            <dt>Excluded</dt>
            <dd>{exclusion}</dd>
          </div>
        ))}
        {[...prepared.warnings, ...prepared.contextPack.warnings].map((warning) => (
          <div key={warning}>
            <dt>Warning</dt>
            <dd>{warning}</dd>
          </div>
        ))}
        {prepared.blockingReasons.map((reason) => (
          <div key={reason}>
            <dt>Blocked</dt>
            <dd>{reason}</dd>
          </div>
        ))}
        {prepared.contextPack.retrievalTrace.map((trace) => (
          <div key={trace}>
            <dt>Retrieval</dt>
            <dd>{trace}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AgentRunDetail({
  actionError,
  actionResult,
  actionRunning,
  detail,
  onRunAction
}: {
  actionError: string | null;
  actionResult: AgentRoomActionResult | null;
  actionRunning: string | null;
  detail: AgentRoomRunDetail;
  onRunAction: (action: string) => void;
}) {
  return (
    <>
      <h3>{detail.run.agentName}</h3>
      <p>{detail.run.taskType}</p>
      <p>{detail.run.status}</p>
      <p>${detail.costSummary.totalCostUsd.toFixed(3)}</p>
      <ActionList actions={detail.run.allowedActions} actionRunning={actionRunning} onRunAction={onRunAction} />
      {actionResult ? <p aria-label="Agent action result">Action {actionResult.action} completed.</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}

      <section aria-label="Run graph detail">
        <h4>Graph</h4>
        <RunGraph steps={detail.graph} />
      </section>

      <section aria-label="Durable job state">
        <h4>Durable Job</h4>
        {detail.durableJob ? (
          <dl className="compact-list">
            <div>
              <dt>{detail.durableJob.id}</dt>
              <dd>
                <span>{detail.durableJob.status}</span>
                <span>{detail.durableJob.workflowType}</span>
                <span>retry {detail.durableJob.retryCount}</span>
              </dd>
            </div>
            <div>
              <dt>Replay lineage</dt>
              <dd>{detail.durableJob.lineage.join(' -> ')}</dd>
            </div>
          </dl>
        ) : (
          <p>No durable job.</p>
        )}
      </section>

      <section aria-label="Context inspector">
        <h4>Context</h4>
        <ContextInspector contextPack={detail.contextPack} />
      </section>

      <section aria-label="Run artifacts">
        <h4>Artifacts</h4>
        {detail.artifacts.length === 0 ? <p>No artifacts.</p> : null}
        <ul>
          {detail.artifacts.map((artifact) => (
            <li key={artifact.id}>{artifact.uri}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Run approvals">
        <h4>Approvals</h4>
        {detail.approvals.length === 0 ? <p>No approvals.</p> : null}
        <ul>
          {detail.approvals.map((approval) => (
            <li key={approval.id}>{approval.title}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ActionList({
  actions,
  actionRunning,
  onRunAction
}: {
  actions: string[];
  actionRunning: string | null;
  onRunAction: (action: string) => void;
}) {
  if (actions.length === 0) {
    return <p>No actions available.</p>;
  }

  return (
    <div aria-label="Agent run actions">
      {actions.map((action) => (
        <button
          disabled={actionRunning !== null}
          key={action}
          onClick={() => onRunAction(action)}
          type="button"
        >
          {actionRunning === action ? `${actionLabel(action)} running...` : `${actionLabel(action)} run`}
        </button>
      ))}
    </div>
  );
}

function actionLabel(action: string): string {
  return action.length === 0 ? 'Run action' : action[0].toUpperCase() + action.slice(1);
}
