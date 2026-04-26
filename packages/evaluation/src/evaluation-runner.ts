import { createEvaluationCase, type EvaluationCase, type EvaluationCaseInput, type EvaluationResult, type RetrievedFact } from './evaluation-case';

export { createEvaluationCase };

export interface RunEvaluationCasesInput {
  cases: EvaluationCase[];
  retrievalPolicyId: string;
  retrieve: (evaluationCase: EvaluationCase) => Promise<RetrievedFact[]> | RetrievedFact[];
}

export async function runEvaluationCases(input: RunEvaluationCasesInput): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (const evaluationCase of input.cases) {
    const retrievedFacts = await input.retrieve(evaluationCase);
    const retrievedFactIds = new Set(retrievedFacts.map((fact) => fact.factId));
    const missingMustHaveFacts = evaluationCase.mustHaveFacts.filter((fact) => !retrievedFactIds.has(fact.id));

    results.push({
      caseId: evaluationCase.id,
      projectId: evaluationCase.projectId,
      query: evaluationCase.query,
      retrievalPolicyId: input.retrievalPolicyId,
      passed: missingMustHaveFacts.length === 0,
      missingMustHaveFacts,
      retrievedFactIds: [...retrievedFactIds]
    });
  }

  return results;
}

export type { EvaluationCase, EvaluationCaseInput, EvaluationResult, RetrievedFact };
