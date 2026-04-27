export interface ProtectedSampleReference {
  sampleId: string;
  text: string;
  policyId: string;
}

export interface SimilarityGuardInput {
  generatedText: string;
  protectedSamples: ProtectedSampleReference[];
  threshold: number;
}

export interface SimilarityEvidence {
  sampleId: string;
  policyId: string;
  similarity: number;
}

export interface SimilarityGuardResult {
  status: 'Allowed' | 'Blocked';
  threshold: number;
  evidence: SimilarityEvidence[];
}

export function evaluateSimilarityGuard(input: SimilarityGuardInput): SimilarityGuardResult {
  const evidence = input.protectedSamples
    .map((sample) => ({
      sampleId: sample.sampleId,
      policyId: sample.policyId,
      similarity: roundSimilarity(jaccardSimilarity(input.generatedText, sample.text))
    }))
    .filter((item) => item.similarity >= input.threshold)
    .sort((left, right) => right.similarity - left.similarity);

  return {
    status: evidence.length > 0 ? 'Blocked' : 'Allowed',
    threshold: input.threshold,
    evidence
  };
}

function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function roundSimilarity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
