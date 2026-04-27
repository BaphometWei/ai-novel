import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type AgentRoomApiClient,
  type AgentRoomActionResult,
  type AgentRoomRunDetail,
  type AgentRoomRunSummary
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

export interface AgentRoomProps {
  client?: AgentRoomApiClient;
}

export function AgentRoom({ client }: AgentRoomProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [state, setState] = useState<AgentRoomState>({ status: 'loading' });

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
              <AgentRunDetail
                actionError={state.actionError}
                actionResult={state.actionResult}
                actionRunning={state.actionRunning}
                detail={state.detail}
                onRunAction={runAction}
              />
            ) : null}
          </section>
        </div>
      ) : null}
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
