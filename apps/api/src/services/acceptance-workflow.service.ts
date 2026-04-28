import type { EntityId } from '@ai-novel/domain';
import {
  extractMemoryFromAcceptedText,
  type MemoryApprovalRequest,
  type MemoryCandidateFact,
  type MemoryExtractionRepository
} from '@ai-novel/workflow';
import type { ManuscriptService } from './manuscript.service';
import type { GovernanceGateService } from './governance-gate.service';

export interface AcceptanceMemoryRepository extends MemoryExtractionRepository {
  linkCandidateApproval(candidateId: string, approvalRequestId: string): Promise<void>;
}

export interface AcceptanceArtifactMetadataStore {
  findById(id: string): Promise<{ id: string; uri: string; relatedRunId?: string } | null>;
}

export interface AcceptanceArtifactContentStore {
  readText(uri: string): Promise<string>;
}

export interface AcceptanceDurableJobStore {
  findByAgentRunId(agentRunId: string): Promise<{ payload: Record<string, unknown> } | null>;
}

export interface AcceptDraftInput {
  chapterId: EntityId<'chapter'>;
  runId: EntityId<'agent_run'>;
  draftArtifactId: EntityId<'artifact'>;
  body: string;
  acceptedBy: string;
}

export interface AcceptDraftResult {
  status: 'Accepted' | 'PendingApproval';
  projectId: string;
  chapterId: string;
  versionId: string;
  sourceRunId: string;
  draftArtifactId: string;
  approvals: Array<{
    id: string;
    targetType: string;
    targetId: string;
    status: string;
    riskLevel: string;
    reason: string;
  }>;
  candidates: MemoryCandidateFact[];
}

export interface AcceptanceWorkflowService {
  acceptDraft(input: AcceptDraftInput): Promise<AcceptDraftResult>;
}

export function createAcceptanceWorkflowService(input: {
  manuscriptService: ManuscriptService;
  memoryRepository: AcceptanceMemoryRepository;
  governanceGate: GovernanceGateService;
  artifacts?: AcceptanceArtifactMetadataStore;
  artifactContent?: AcceptanceArtifactContentStore;
  durableJobs?: AcceptanceDurableJobStore;
  clock?: () => string;
  createId?: (prefix: 'memory_candidate' | 'approval_request') => string;
}): AcceptanceWorkflowService {
  return new RepositoryAcceptanceWorkflowService(
    input.manuscriptService,
    input.memoryRepository,
    input.governanceGate,
    input.artifacts,
    input.artifactContent,
    input.durableJobs,
    input.clock ?? (() => new Date().toISOString()),
    input.createId ?? ((prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`)
  );
}

class RepositoryAcceptanceWorkflowService implements AcceptanceWorkflowService {
  constructor(
    private readonly manuscriptService: ManuscriptService,
    private readonly memoryRepository: AcceptanceMemoryRepository,
    private readonly governanceGate: GovernanceGateService,
    private readonly artifacts: AcceptanceArtifactMetadataStore | undefined,
    private readonly artifactContent: AcceptanceArtifactContentStore | undefined,
    private readonly durableJobs: AcceptanceDurableJobStore | undefined,
    private readonly clock: () => string,
    private readonly createId: (prefix: 'memory_candidate' | 'approval_request') => string
  ) {}

  async acceptDraft(input: AcceptDraftInput): Promise<AcceptDraftResult> {
    const chapter = await this.manuscriptService.findChapterById(input.chapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${input.chapterId}`);
    }
    await this.assertDraftProvenance(input, chapter.projectId);

    const version = await this.manuscriptService.addChapterVersion(input.chapterId, {
      body: input.body,
      status: 'Draft',
      makeCurrent: false,
      metadata: {
        acceptedBy: input.acceptedBy,
        acceptedFromRunId: input.runId,
        draftArtifactId: input.draftArtifactId,
        governanceStatus: 'PendingApproval'
      }
    });

    const memory = await extractMemoryFromAcceptedText(
      {
        projectId: chapter.projectId,
        source: {
          kind: 'AcceptedManuscriptText',
          manuscriptVersionId: version.id,
          text: input.body
        }
      },
      {
        extractor: {
          extract: ({ acceptedText }) => [
            {
              text: firstSentence(acceptedText),
              kind: 'WorldRule',
              confidence: 0.9,
              riskLevel: 'High',
              evidence: firstSentence(acceptedText)
            }
          ]
        },
        clock: this.clock,
        createId: this.createId,
        repository: this.memoryRepository
      }
    );

    for (const approval of memory.approvalRequests) {
      await this.memoryRepository.linkCandidateApproval(approval.candidateId, approval.id);
      await this.governanceGate.recordApprovalReference({
        projectId: approval.projectId,
        targetType: 'memory_candidate_fact',
        targetId: approval.candidateId,
        approvalRequestId: approval.id,
        status: approval.status,
        riskLevel: toApprovalRiskLevel(approval),
        reason: `Memory candidate from manuscript version ${approval.manuscriptVersionId} requires approval`,
        sourceRunId: input.runId,
        createdAt: approval.createdAt
      });
    }

    return {
      status: memory.approvalRequests.length > 0 ? 'PendingApproval' : 'Accepted',
      projectId: chapter.projectId,
      chapterId: chapter.id,
      versionId: version.id,
      sourceRunId: input.runId,
      draftArtifactId: input.draftArtifactId,
      approvals: memory.approvalRequests.map((approval) => toApprovalSummary(approval)),
      candidates: memory.candidates
    };
  }

  private async assertDraftProvenance(input: AcceptDraftInput, projectId: string): Promise<void> {
    if (!this.artifacts || !this.artifactContent || !this.durableJobs) return;

    const [artifact, job] = await Promise.all([
      this.artifacts.findById(input.draftArtifactId),
      this.durableJobs.findByAgentRunId(input.runId)
    ]);
    if (!artifact || artifact.relatedRunId !== input.runId || !job) {
      throw new Error('Draft provenance mismatch');
    }
    if (job.payload.projectId !== projectId || job.payload.draftArtifactId !== input.draftArtifactId) {
      throw new Error('Draft provenance mismatch');
    }
    const target = job.payload.target;
    if (!target || typeof target !== 'object' || (target as { chapterId?: unknown }).chapterId !== input.chapterId) {
      throw new Error('Draft provenance mismatch');
    }

    const stored = await this.artifactContent.readText(artifact.uri);
    if (parseStoredDraftArtifact(stored).text !== input.body) {
      throw new Error('Draft provenance mismatch');
    }
  }
}

function parseStoredDraftArtifact(content: string): { text: string } {
  try {
    const parsed = JSON.parse(content) as { text?: unknown };
    if (typeof parsed.text === 'string') return { text: parsed.text };
  } catch {
    // fall through to the provenance error below
  }
  throw new Error('Draft provenance mismatch');
}

function toApprovalSummary(approval: MemoryApprovalRequest): AcceptDraftResult['approvals'][number] {
  return {
    id: approval.id,
    targetType: 'memory_candidate_fact',
    targetId: approval.candidateId,
    status: approval.status,
    riskLevel: toApprovalRiskLevel(approval),
    reason: `Memory candidate from manuscript version ${approval.manuscriptVersionId} requires approval`
  };
}

function toApprovalRiskLevel(approval: MemoryApprovalRequest): 'Medium' | 'High' | 'Blocking' {
  return approval.riskLevel === 'Low' ? 'Medium' : approval.riskLevel;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?。！？])\s+/u)[0]?.trim() || text.trim();
}
