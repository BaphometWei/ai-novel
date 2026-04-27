import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type AuthorshipAuditResult,
  type GovernanceApiClient,
  type PersistedApprovalReference,
  type PersistedAuditFinding
} from '../api/client';

export interface GovernanceAuditPanelProps {
  client?: GovernanceApiClient;
}

export function GovernanceAuditPanel({ client }: GovernanceAuditPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [allowedResult, setAllowedResult] = useState<AuthorshipAuditResult | null>(null);
  const [blockedResult, setBlockedResult] = useState<AuthorshipAuditResult | null>(null);
  const [auditFindings, setAuditFindings] = useState<PersistedAuditFinding[]>([]);
  const [approvalReferences, setApprovalReferences] = useState<PersistedApprovalReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [allowed, blocked, findings, approvals] = await Promise.all([
          resolvedClient.inspectAuthorshipAudit(allowedAuditInput),
          resolvedClient.inspectAuthorshipAudit(blockedAuditInput),
          resolvedClient.listAuditFindingsByTarget(historyTarget.projectId, historyTarget.targetType, historyTarget.targetId),
          resolvedClient.listApprovalReferencesByTarget(historyTarget.projectId, historyTarget.targetType, historyTarget.targetId)
        ]);
        if (!cancelled) {
          setAllowedResult(allowed);
          setBlockedResult(blocked);
          setAuditFindings(findings);
          setApprovalReferences(approvals);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load governance audit');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [resolvedClient]);

  return (
    <section className="surface-panel" aria-labelledby="governance-audit-title">
      <header className="panel-header">
        <h2 id="governance-audit-title">Governance Audit</h2>
        <span>Authorship transitions</span>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p>Loading governance audit...</p> : null}

      <div className="panel-grid">
        <AuditResultCard label="Allowed authorship transition" result={allowedResult} />
        <AuditResultCard label="Blocked authorship transition" result={blockedResult} />
      </div>

      <PersistedGovernanceHistory auditFindings={auditFindings} approvalReferences={approvalReferences} />
    </section>
  );
}

function AuditResultCard({ label, result }: { label: string; result: AuthorshipAuditResult | null }) {
  return (
    <section className="work-surface" aria-label={label}>
      <h3>{label.includes('Allowed') ? 'Allowed Transition' : 'Blocked Transition'}</h3>
      {result ? (
        <dl className="compact-list">
          <div>
            <dt>{result.action}</dt>
            <dd>
              <span>{result.allowed ? 'Allowed' : 'Blocked'}</span>
              <span>{result.approvalRequired ? 'Approval required' : 'No approval needed'}</span>
              {(result.blockers ?? []).map((blocker) => (
                <span key={blocker}>{blocker}</span>
              ))}
              {(result.approvalReasons ?? []).map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

function PersistedGovernanceHistory({
  auditFindings,
  approvalReferences
}: {
  auditFindings: PersistedAuditFinding[];
  approvalReferences: PersistedApprovalReference[];
}) {
  if (auditFindings.length === 0 && approvalReferences.length === 0) return null;

  return (
    <section className="work-surface" aria-label="Persisted governance history">
      <h3>Persisted governance history</h3>
      <dl className="compact-list">
        {auditFindings.map((record) => (
          <div key={record.id}>
            <dt>{String(record.finding.code ?? record.id)}</dt>
            <dd>
              <span>{String(record.finding.riskLevel ?? 'Unknown risk')}</span>
              <span>{record.targetType}: {record.targetId}</span>
            </dd>
          </div>
        ))}
        {approvalReferences.map((reference) => (
          <div key={reference.id}>
            <dt>{reference.approvalRequestId}</dt>
            <dd>
              <span>{reference.status}</span>
              <span>{reference.riskLevel}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const allowedAuditInput = {
  projectId: 'project_demo',
  source: { type: 'agent_run', id: 'run_1' },
  actor: { type: 'user', id: 'user_editor' },
  action: 'accept_manuscript_version',
  target: { manuscriptVersionId: 'manuscript_v2' },
  transition: { from: 'DraftArtifact', to: 'ManuscriptVersion' },
  inspectedAt: '2026-04-27T12:00:00.000Z'
};

const blockedAuditInput = {
  ...allowedAuditInput,
  action: 'overwrite_manuscript_version',
  target: { manuscriptVersionId: 'manuscript_v1' },
  transition: { from: 'UserAccepted', to: 'ManuscriptVersion' }
};

const historyTarget = {
  projectId: 'project_demo',
  targetType: 'CanonFact',
  targetId: 'canon_fact_1'
};
