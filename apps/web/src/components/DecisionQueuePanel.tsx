import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type ApprovalItem, type ApprovalsApiClient } from '../api/client';

interface DecisionQueuePanelProps {
  client?: ApprovalsApiClient;
  projectId?: string;
}

type QueueState =
  | { status: 'loading'; items: ApprovalItem[] }
  | { status: 'loaded'; items: ApprovalItem[] }
  | { status: 'error'; items: ApprovalItem[]; message: string };

export function DecisionQueuePanel({ client, projectId }: DecisionQueuePanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [state, setState] = useState<QueueState>({ status: 'loading', items: [] });
  const [postingId, setPostingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadQueue() {
      setState({ status: 'loading', items: [] });
      try {
        const items = await resolvedClient.listPendingApprovals(projectId ? { projectId } : undefined);
        if (isMounted) setState({ status: 'loaded', items: pendingItems(items, projectId) });
      } catch (error) {
        if (isMounted) {
          setState({
            status: 'error',
            items: [],
            message: error instanceof Error ? error.message : 'Unable to load decision queue'
          });
        }
      }
    }

    void loadQueue();

    return () => {
      isMounted = false;
    };
  }, [projectId, resolvedClient]);

  async function decide(item: ApprovalItem, decision: 'approve' | 'reject') {
    setPostingId(item.id);
    try {
      const updated =
        decision === 'approve'
          ? await resolvedClient.approve(item.id, { decidedBy: 'operator' })
          : await resolvedClient.reject(item.id, { decidedBy: 'operator' });
      setState((current) => ({
        status: 'loaded',
        items: pendingItems(current.items.map((currentItem) => (currentItem.id === item.id ? updated : currentItem)), projectId)
      }));
    } catch (error) {
      setState((current) => ({
        status: 'error',
        items: current.items,
        message: error instanceof Error ? error.message : 'Unable to post decision'
      }));
    } finally {
      setPostingId(null);
    }
  }

  const items = state.items;

  return (
    <aside className="decision-panel" aria-label="Decision Queue">
      <header>
        <h2>Decision Queue</h2>
        <span>{items.length}</span>
      </header>
      {state.status === 'loading' ? <p>Loading decisions...</p> : null}
      {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
      {state.status !== 'loading' && items.length === 0 ? <p>No blocking decisions.</p> : null}
      {items.map((item) => (
        <article key={item.id} aria-label={item.title}>
          <h3>{item.title}</h3>
          {item.reason ? <p>{item.reason}</p> : null}
          {item.proposedAction ? <p>{item.proposedAction}</p> : null}
          <p>{item.riskLevel ?? 'Risk unknown'} / {item.status}</p>
          <div>
            <button
              type="button"
              onClick={() => void decide(item, 'approve')}
              disabled={postingId === item.id}
              aria-label={`Approve ${item.title}`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => void decide(item, 'reject')}
              disabled={postingId === item.id}
              aria-label={`Reject ${item.title}`}
            >
              Reject
            </button>
          </div>
        </article>
      ))}
    </aside>
  );
}

function pendingItems(items: ApprovalItem[], projectId?: string): ApprovalItem[] {
  return items.filter((item) => item.status === 'Pending' && (!projectId || item.projectId === projectId));
}
