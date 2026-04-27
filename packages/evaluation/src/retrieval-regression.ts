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
  snapshot: RetrievalRegressionSnapshot;
}

export function evaluateRetrievalRegression(input: EvaluateRetrievalRegressionInput): RetrievalRegressionResult {
  const includedIds = new Set(input.included.map((item) => item.id));
  const failures: RetrievalRegressionFailure[] = [
    ...input.mustInclude
      .filter((item) => !includedIds.has(item.id))
      .map((item) => ({ type: 'must_include_missing' as const, itemId: item.id })),
    ...input.forbidden
      .filter((item) => includedIds.has(item.id))
      .map((item) => ({ type: 'forbidden_included' as const, itemId: item.id }))
  ];

  return {
    caseId: input.caseId,
    projectId: input.projectId,
    query: input.query,
    policyId: input.policy.id,
    passed: failures.length === 0,
    failures,
    snapshot: {
      query: input.query,
      policy: input.policy,
      included: input.included,
      excluded: input.excluded,
      failures
    }
  };
}
