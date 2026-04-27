export type NarrativeRegressionScope = 'canon' | 'manuscript' | 'timeline' | 'promise' | 'secret' | 'world_rule';
export type NarrativeRegressionCheckStatus = 'Pending' | 'Passed' | 'Failed';

export interface NarrativeRegressionCheck {
  scope: NarrativeRegressionScope;
  status: NarrativeRegressionCheckStatus;
  evidence: string[];
}

export interface NarrativeRegressionResult {
  status: 'Passed' | 'Blocked';
  checks: NarrativeRegressionCheck[];
  failures: NarrativeRegressionCheck[];
}

export const REQUIRED_REGRESSION_SCOPES: NarrativeRegressionScope[] = [
  'canon',
  'manuscript',
  'timeline',
  'promise',
  'secret',
  'world_rule'
];

export function createPendingRegressionChecks(): NarrativeRegressionCheck[] {
  return REQUIRED_REGRESSION_SCOPES.map((scope) => ({ scope, status: 'Pending', evidence: [] }));
}

export function runNarrativeRegressionChecks(checks: NarrativeRegressionCheck[]): NarrativeRegressionResult {
  const checksByScope = new Map(checks.map((check) => [check.scope, check]));
  const failures: NarrativeRegressionCheck[] = [];

  for (const scope of REQUIRED_REGRESSION_SCOPES) {
    const check = checksByScope.get(scope);

    if (!check) {
      failures.push({
        scope,
        status: 'Failed',
        evidence: [`Missing required regression check for ${scope}`]
      });
      continue;
    }

    if (check.status === 'Failed') {
      failures.push(check);
      continue;
    }

    if (check.status !== 'Passed') {
      failures.push({
        scope,
        status: 'Failed',
        evidence: [`Regression check for ${scope} is ${check.status}`]
      });
      continue;
    }

    if (check.evidence.length === 0) {
      failures.push({
        scope,
        status: 'Failed',
        evidence: [`Missing regression evidence for ${scope}`]
      });
    }
  }

  return {
    status: failures.length > 0 ? 'Blocked' : 'Passed',
    checks,
    failures
  };
}
