export interface RetrievalRegressionItem {
  id: string;
  text?: string;
}

export interface RetrievalRegressionExcludedItem {
  id: string;
  reason: string;
}

export interface RetrievalRegressionPolicySnapshot {
  id: string;
  description?: string;
}

export interface EvaluateRetrievalRegressionInput {
  caseId: string;
  projectId: string;
  query: string;
  policy: RetrievalRegressionPolicySnapshot;
  mustInclude: RetrievalRegressionItem[];
  forbidden: RetrievalRegressionItem[];
  included: RetrievalRegressionItem[];
  excluded: RetrievalRegressionExcludedItem[];
}

export type RetrievalRegressionFailure =
  | { type: 'must_include_missing'; itemId: string }
  | { type: 'forbidden_included'; itemId: string };

export interface RetrievalRegressionThresholds {
  requiredCoverage: number;
  forbiddenLeakage: number;
}

export interface RetrievalRegressionTriageHint {
  itemId: string;
  severity: 'blocking';
  message: string;
}

export interface RetrievalRegressionSnapshot {
  query: string;
  policy: RetrievalRegressionPolicySnapshot;
  included: RetrievalRegressionItem[];
  excluded: RetrievalRegressionExcludedItem[];
  failures: RetrievalRegressionFailure[];
}

export interface RetrievalRegressionResult {
  caseId: string;
  projectId: string;
  query: string;
  policyId: string;
  passed: boolean;
  failures: RetrievalRegressionFailure[];
  thresholds: RetrievalRegressionThresholds;
  includedIds: string[];
  excludedIds: string[];
  triageHints: RetrievalRegressionTriageHint[];
  snapshot: RetrievalRegressionSnapshot;
}

export function evaluateRetrievalRegression(input: EvaluateRetrievalRegressionInput): RetrievalRegressionResult {
  const includedIds = input.included.map((item) => item.id);
  const excludedIds = input.excluded.map((item) => item.id);
  const includedIdSet = new Set(includedIds);
  const failures: RetrievalRegressionFailure[] = [
    ...input.mustInclude
      .filter((item) => !includedIdSet.has(item.id))
      .map((item) => ({ type: 'must_include_missing' as const, itemId: item.id })),
    ...input.forbidden
      .filter((item) => includedIdSet.has(item.id))
      .map((item) => ({ type: 'forbidden_included' as const, itemId: item.id }))
  ];
  const excludedReasons = new Map(input.excluded.map((item) => [item.id, item.reason]));
  const triageHints = failures.map((failure): RetrievalRegressionTriageHint => {
    if (failure.type === 'forbidden_included') {
      return {
        itemId: failure.itemId,
        severity: 'blocking',
        message: `Forbidden retrieval item ${failure.itemId} was included in context.`
      };
    }

    const reason = excludedReasons.get(failure.itemId);
    return {
      itemId: failure.itemId,
      severity: 'blocking',
      message: reason
        ? `Required retrieval item ${failure.itemId} was excluded: ${reason}.`
        : `Required retrieval item ${failure.itemId} was missing from included context.`
    };
  });

  return {
    caseId: input.caseId,
    projectId: input.projectId,
    query: input.query,
    policyId: input.policy.id,
    passed: failures.length === 0,
    failures,
    thresholds: {
      requiredCoverage: 1,
      forbiddenLeakage: 0
    },
    includedIds,
    excludedIds,
    triageHints,
    snapshot: {
      query: input.query,
      policy: input.policy,
      included: input.included,
      excluded: input.excluded,
      failures
    }
  };
}
