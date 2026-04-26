export interface MustHaveFact {
  id: string;
  text: string;
}

export interface EvaluationCaseInput {
  id: string;
  projectId: string;
  query: string;
  mustHaveFacts: MustHaveFact[];
}

export interface EvaluationCase extends EvaluationCaseInput {
  createdAt: string;
}

export interface RetrievedFact {
  factId: string;
  text: string;
}

export interface EvaluationResult {
  caseId: string;
  projectId: string;
  query: string;
  retrievalPolicyId: string;
  passed: boolean;
  missingMustHaveFacts: MustHaveFact[];
  retrievedFactIds: string[];
}

export function createEvaluationCase(input: EvaluationCaseInput): EvaluationCase {
  return {
    ...input,
    createdAt: new Date(0).toISOString()
  };
}
