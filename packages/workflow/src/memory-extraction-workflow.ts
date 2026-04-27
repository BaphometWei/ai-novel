export type MemoryRiskLevel = 'Low' | 'Medium' | 'High';
export type MemoryCandidateKind = 'CharacterFact' | 'WorldRule' | 'TimelineEvent' | 'Promise' | 'NegativeMemory';

export interface AcceptedManuscriptTextSource {
  kind: 'AcceptedManuscriptText';
  manuscriptVersionId: string;
  text: string;
}

export interface DraftArtifactTextSource {
  kind: 'DraftArtifactText';
  artifactId: string;
  text: string;
}

export interface AgentGeneratedTextSource {
  kind: 'AgentGeneratedText';
  agentRunId: string;
  text: string;
}

export type MemoryExtractionSource =
  | AcceptedManuscriptTextSource
  | DraftArtifactTextSource
  | AgentGeneratedTextSource;

export interface MemoryExtractionInput {
  projectId: string;
  source: MemoryExtractionSource;
}

export interface ExtractedMemoryFact {
  text: string;
  kind: MemoryCandidateKind;
  confidence: number;
  riskLevel: MemoryRiskLevel;
  evidence: string;
}

export interface MemoryExtractor {
  extract(input: {
    projectId: string;
    manuscriptVersionId: string;
    acceptedText: string;
  }): Promise<ExtractedMemoryFact[]> | ExtractedMemoryFact[];
}

export interface MemoryCandidateFact extends ExtractedMemoryFact {
  id: string;
  projectId: string;
  manuscriptVersionId: string;
  sourceKind: 'AcceptedManuscriptText';
  status: 'Candidate';
  createdAt: string;
}

export interface MemoryApprovalRequest {
  id: string;
  projectId: string;
  candidateId: string;
  manuscriptVersionId: string;
  riskLevel: MemoryRiskLevel;
  status: 'Pending';
  requestedAction: 'PromoteMemoryCandidateToCanon';
  createdAt: string;
}

export interface MemoryExtractionRepository {
  saveCandidate(candidate: MemoryCandidateFact): Promise<void> | void;
  saveApprovalRequest(request: MemoryApprovalRequest): Promise<void> | void;
}

export interface MemoryExtractionDependencies {
  extractor: MemoryExtractor;
  clock: () => string;
  createId: (prefix: 'memory_candidate' | 'approval_request') => string;
  repository: MemoryExtractionRepository;
}

export interface MemoryExtractionResult {
  candidates: MemoryCandidateFact[];
  approvalRequests: MemoryApprovalRequest[];
}

export async function extractMemoryFromAcceptedText(
  input: MemoryExtractionInput,
  dependencies: MemoryExtractionDependencies
): Promise<MemoryExtractionResult> {
  if (input.source.kind !== 'AcceptedManuscriptText') {
    throw new Error('Memory extraction requires accepted manuscript text');
  }
  const acceptedSource = input.source;

  const extractedFacts = await dependencies.extractor.extract({
    projectId: input.projectId,
    manuscriptVersionId: acceptedSource.manuscriptVersionId,
    acceptedText: acceptedSource.text
  });

  const candidates = extractedFacts.map((fact) =>
    createCandidate(input.projectId, acceptedSource, fact, dependencies)
  );
  const approvalRequests = candidates
    .filter((candidate) => candidate.riskLevel === 'High')
    .map((candidate) => createApprovalRequest(candidate, dependencies));

  for (const candidate of candidates) {
    await dependencies.repository.saveCandidate(candidate);
  }
  for (const request of approvalRequests) {
    await dependencies.repository.saveApprovalRequest(request);
  }

  return { candidates, approvalRequests };
}

function createCandidate(
  projectId: string,
  source: AcceptedManuscriptTextSource,
  fact: ExtractedMemoryFact,
  dependencies: MemoryExtractionDependencies
): MemoryCandidateFact {
  return {
    id: dependencies.createId('memory_candidate'),
    projectId,
    manuscriptVersionId: source.manuscriptVersionId,
    sourceKind: 'AcceptedManuscriptText',
    status: 'Candidate',
    createdAt: dependencies.clock(),
    ...fact
  };
}

function createApprovalRequest(
  candidate: MemoryCandidateFact,
  dependencies: MemoryExtractionDependencies
): MemoryApprovalRequest {
  return {
    id: dependencies.createId('approval_request'),
    projectId: candidate.projectId,
    candidateId: candidate.id,
    manuscriptVersionId: candidate.manuscriptVersionId,
    riskLevel: candidate.riskLevel,
    status: 'Pending',
    requestedAction: 'PromoteMemoryCandidateToCanon',
    createdAt: dependencies.clock()
  };
}
