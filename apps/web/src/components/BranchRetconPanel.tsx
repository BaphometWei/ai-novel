import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type BranchAdoptResult,
  type BranchProjectInput,
  type BranchProjectResult,
  type BranchRetconApiClient,
  type PersistedBranchScenario,
  type PersistedRegressionCheckRun,
  type PersistedRetconProposal,
  type RegressionRunResult,
  type RetconProposalInput,
  type RetconProposalResult
} from '../api/client';

export interface BranchRetconPanelProps {
  client?: BranchRetconApiClient;
  projectId?: string;
}

export function BranchRetconPanel({ client, projectId }: BranchRetconPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const activeProjectId = projectId ?? '';
  const hasProject = activeProjectId.trim().length > 0;
  const [branchResult, setBranchResult] = useState<BranchProjectResult | null>(null);
  const [adoptResult, setAdoptResult] = useState<BranchAdoptResult | null>(null);
  const [retconResult, setRetconResult] = useState<RetconProposalResult | null>(null);
  const [regressionResult, setRegressionResult] = useState<RegressionRunResult | null>(null);
  const [persistedScenarios, setPersistedScenarios] = useState<PersistedBranchScenario[]>([]);
  const [persistedProposals, setPersistedProposals] = useState<PersistedRetconProposal[]>([]);
  const [persistedRuns, setPersistedRuns] = useState<PersistedRegressionCheckRun[]>([]);
  const [loading, setLoading] = useState(hasProject);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasProject) {
      setBranchResult(null);
      setAdoptResult(null);
      setRetconResult(null);
      setRegressionResult(null);
      setPersistedScenarios([]);
      setPersistedProposals([]);
      setPersistedRuns([]);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const branchProjectInput = createBranchProjectInput(activeProjectId);
        const retconInput = createRetconInput(activeProjectId);
        const historyTarget = createHistoryTarget(activeProjectId);
        const projected = await resolvedClient.projectBranchScenario(branchProjectInput);
        const [adopted, proposal] = await Promise.all([
          resolvedClient.adoptBranchScenario({ canon, scenario: projected.scenario }),
          resolvedClient.createRetconProposal(retconInput)
        ]);
        const regression = await resolvedClient.runRetconRegressionChecks({
          projectId: activeProjectId,
          proposalId: proposal.proposal.id ?? '',
          checks: proposal.proposal.regressionChecks ?? []
        });
        const [scenarios, proposals] = await Promise.all([
          resolvedClient.listBranchScenarios(historyTarget.projectId),
          resolvedClient.listRetconProposalsByTarget(historyTarget.projectId, historyTarget.targetType, historyTarget.targetId)
        ]);
        const runs = (
          await Promise.all(
            proposals.map((savedProposal) =>
              resolvedClient.listRegressionCheckRuns(historyTarget.projectId, savedProposal.id)
            )
          )
        ).flat();

        if (!cancelled) {
          setBranchResult(projected);
          setAdoptResult(adopted);
          setRetconResult(proposal);
          setRegressionResult(regression);
          setPersistedScenarios(scenarios);
          setPersistedProposals(proposals);
          setPersistedRuns(runs);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load branch and retcon checks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, hasProject, resolvedClient]);

  return (
    <section className="surface-panel" aria-labelledby="branch-retcon-title">
      <header className="panel-header">
        <h2 id="branch-retcon-title">Branch &amp; Retcon</h2>
        <span>Scenario control</span>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {!hasProject ? <p>No project available.</p> : null}
      {loading ? <p>Preparing branch and retcon checks...</p> : null}

      <div className="panel-grid">
        <BranchProjectionCard branchResult={branchResult} adoptResult={adoptResult} />
        <RetconProposalCard
          fallbackRetconInput={createRetconInput(activeProjectId)}
          retconResult={retconResult}
          regressionResult={regressionResult}
        />
      </div>

      <PersistedBranchRetconHistory
        scenarios={persistedScenarios}
        proposals={persistedProposals}
        runs={persistedRuns}
      />
    </section>
  );
}

function BranchProjectionCard({
  branchResult,
  adoptResult
}: {
  branchResult: BranchProjectResult | null;
  adoptResult: BranchAdoptResult | null;
}) {
  return (
    <section className="work-surface" aria-label="Branch scenario projection">
      <h3>Branch Projection</h3>
      {branchResult ? (
        <dl className="compact-list">
          <div>
            <dt>{branchResult.scenario.title}</dt>
            <dd>{branchResult.scenario.baseCanonFactIds.join(', ')}</dd>
          </div>
          <div>
            <dt>Artifacts</dt>
            <dd>{branchResult.scenario.artifacts.map((artifact) => artifact.id).join(', ')}</dd>
          </div>
          <div>
            <dt>Projection</dt>
            <dd>{projectionSummary(branchResult.projection)}</dd>
          </div>
          {adoptResult ? (
            <div>
              <dt>Adoption</dt>
              <dd>adopted: {adoptResult.canon.canonFactIds.join(', ')}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function PersistedBranchRetconHistory({
  scenarios,
  proposals,
  runs
}: {
  scenarios: PersistedBranchScenario[];
  proposals: PersistedRetconProposal[];
  runs: PersistedRegressionCheckRun[];
}) {
  if (scenarios.length === 0 && proposals.length === 0 && runs.length === 0) return null;

  return (
    <section className="work-surface" aria-label="Persisted branch retcon history">
      <h3>Persisted branch retcon history</h3>
      <dl className="compact-list">
        {scenarios.map((scenario) => (
          <div key={scenario.id}>
            <dt>{scenario.id}</dt>
            <dd>{scenario.status}</dd>
          </div>
        ))}
        {proposals.map((proposal) => (
          <div key={proposal.id}>
            <dt>{proposal.id}</dt>
            <dd>{proposal.status}</dd>
          </div>
        ))}
        {runs.map((run) => (
          <div key={run.id}>
            <dt>{run.id}</dt>
            <dd>{run.status}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RetconProposalCard({
  fallbackRetconInput,
  retconResult,
  regressionResult
}: {
  fallbackRetconInput: RetconProposalInput;
  retconResult: RetconProposalResult | null;
  regressionResult: RegressionRunResult | null;
}) {
  const title = retconResult?.proposal.title ?? String(retconResult?.proposal.id ?? 'Retcon proposal');
  const checks = regressionResult?.checks ?? retconResult?.regression.checks ?? [];

  return (
    <section className="work-surface" aria-label="Retcon proposal">
      <h3>Retcon Proposal</h3>
      {retconResult ? (
        <dl className="compact-list">
          <div>
            <dt>{title}</dt>
            <dd>{(regressionResult ?? retconResult.regression).passed ? 'Passed' : 'Failed'}</dd>
          </div>
          <div>
            <dt>Before</dt>
            <dd>{String(retconResult.proposal.before ?? fallbackRetconInput.before)}</dd>
          </div>
          <div>
            <dt>After</dt>
            <dd>{String(retconResult.proposal.after ?? fallbackRetconInput.after)}</dd>
          </div>
          {checks.map((check) => (
            <div key={`${check.scope}-${check.status}`}>
              <dt>{check.scope}</dt>
              <dd>
                <span>Check {check.status}</span>
                <span>{check.evidence.join(', ')}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function projectionSummary(projection: Record<string, unknown>): string {
  return Object.values(projection)
    .flatMap((value) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []))
    .join(', ');
}

const canon = {
  canonFactIds: ['canon_archive'],
  artifactIds: ['artifact_draft_1']
};

function createBranchProjectInput(projectId: string): BranchProjectInput {
  return {
    canon,
    scenario: {
      projectId,
      title: 'Moonlit Archive Branch',
      baseCanonFactIds: ['canon_archive'],
      artifacts: [{ id: 'artifact_branch_scene', kind: 'scene', content: 'Mira finds the hidden key.' }]
    }
  };
}

function createRetconInput(projectId: string): RetconProposalInput {
  return {
    projectId,
    target: { type: 'canon_fact', id: 'canon_archive' },
    before: 'The door was sealed by the city.',
    after: 'The door was sealed by Mira mother.',
    affected: {
      canonFacts: ['canon_archive'],
      manuscriptChapters: ['chapter_3'],
      timelineEvents: ['timeline_event_2'],
      promises: ['promise_locked_door'],
      secrets: [],
      worldRules: []
    }
  };
}

function createHistoryTarget(projectId: string) {
  return {
    projectId,
    targetType: 'CanonFact',
    targetId: 'fact_key_location'
  };
}
