import { createId, type ContextPack, type EntityId, type ProviderAdapter } from '@ai-novel/domain';
import type { AuthorshipLevel } from './authorship';

export type WritingWorkflowStatus = 'AwaitingAcceptance' | 'Failed';

export interface WritingContract {
  authorshipLevel: Exclude<AuthorshipLevel, 'A0'>;
  goal: string;
  mustWrite: string;
  wordRange: { min: number; max: number };
  forbiddenChanges: string[];
  acceptanceCriteria: string[];
}

export interface WritingWorkflowInput {
  projectId: EntityId<'project'>;
  target: {
    manuscriptId: EntityId<'manuscript'>;
    chapterId: EntityId<'chapter'>;
    range: string;
  };
  contract: WritingContract;
  retrieval: {
    query: string;
    maxContextItems?: number;
    maxSectionChars?: number;
  };
  unsafeCallerContextSections?: Array<{ name: string; content: string }>;
}

export interface WritingContextBuildRequest {
  projectId: EntityId<'project'>;
  taskGoal: string;
  agentRole: 'Writer';
  riskLevel: 'Medium';
  query: string;
  maxContextItems?: number;
  maxSectionChars?: number;
  contract: WritingContract;
  target: WritingWorkflowInput['target'];
}

export interface WritingWorkflowDependencies {
  provider: ProviderAdapter;
  buildContext(input: WritingContextBuildRequest): Promise<ContextPack> | ContextPack;
  model?: string;
}

export interface DraftProseArtifact {
  id: EntityId<'artifact'>;
  type: 'draft_prose';
  status: 'Draft';
  text: string;
  contextPackId: EntityId<'context_pack'>;
}

export interface SelfCheckArtifact {
  id: EntityId<'artifact'>;
  type: 'self_check';
  status: 'Completed';
  result: {
    summary: string;
    passed: boolean;
    findings: string[];
  };
}

export interface WritingWorkflowResult {
  id: EntityId<'agent_run'>;
  status: WritingWorkflowStatus;
  contract: WritingContract;
  contextPack: ContextPack;
  draftArtifact: DraftProseArtifact;
  selfCheckArtifact: SelfCheckArtifact;
  review: {
    status: 'Completed';
    requiresAuthorAcceptance: true;
    artifactId: EntityId<'artifact'>;
  };
  manuscriptVersionId: EntityId<'manuscript_version'> | null;
}

export async function runWritingWorkflow(
  input: WritingWorkflowInput,
  dependencies: WritingWorkflowDependencies
): Promise<WritingWorkflowResult> {
  assertWritingContract(input.contract);
  const contextPack = await dependencies.buildContext({
    projectId: input.projectId,
    taskGoal: input.contract.goal,
    agentRole: 'Writer',
    riskLevel: 'Medium',
    query: input.retrieval.query,
    maxContextItems: input.retrieval.maxContextItems,
    maxSectionChars: input.retrieval.maxSectionChars,
    contract: input.contract,
    target: input.target
  });

  const draft = await dependencies.provider.generateText({
    model: dependencies.model,
    prompt: buildWritingDraftPrompt(input, contextPack)
  });
  const selfCheck = await dependencies.provider.generateStructured<SelfCheckArtifact['result']>({
    model: dependencies.model,
    schemaName: 'WritingSelfCheck',
    prompt: buildSelfCheckPrompt(input, contextPack, draft.text)
  });

  const selfCheckArtifact: SelfCheckArtifact = {
    id: createId('artifact'),
    type: 'self_check',
    status: 'Completed',
    result: normalizeSelfCheck(selfCheck.value)
  };

  return {
    id: createId('agent_run'),
    status: 'AwaitingAcceptance',
    contract: input.contract,
    contextPack,
    draftArtifact: {
      id: createId('artifact'),
      type: 'draft_prose',
      status: 'Draft',
      text: draft.text,
      contextPackId: contextPack.id
    },
    selfCheckArtifact,
    review: {
      status: 'Completed',
      requiresAuthorAcceptance: true,
      artifactId: selfCheckArtifact.id
    },
    manuscriptVersionId: null
  };
}

function assertWritingContract(contract: WritingContract): void {
  if (contract.wordRange.min <= 0 || contract.wordRange.max < contract.wordRange.min) {
    throw new Error('WritingContract wordRange must be positive and ordered');
  }
  if (!contract.goal.trim() || !contract.mustWrite.trim()) {
    throw new Error('WritingContract goal and mustWrite are required');
  }
}

export function buildWritingDraftPrompt(input: WritingWorkflowInput, contextPack: ContextPack): string {
  return [
    'Role: Writer',
    `Project: ${input.projectId}`,
    `Target manuscript: ${input.target.manuscriptId}`,
    `Target chapter: ${input.target.chapterId}`,
    `Target range: ${input.target.range}`,
    `Goal: ${input.contract.goal}`,
    `Must write: ${input.contract.mustWrite}`,
    `Word range: ${input.contract.wordRange.min}-${input.contract.wordRange.max}`,
    formatList('Forbidden changes', input.contract.forbiddenChanges),
    formatList('Acceptance criteria', input.contract.acceptanceCriteria),
    'Context Pack:',
    ...contextPack.sections.map((section) => `[${section.name}]\n${section.content}`),
    formatList('Warnings', contextPack.warnings),
    'Return draft prose only. Do not mark it accepted.'
  ].join('\n');
}

function buildSelfCheckPrompt(input: WritingWorkflowInput, contextPack: ContextPack, draftText: string): string {
  return [
    'Review the draft against the WritingContract.',
    `Goal: ${input.contract.goal}`,
    formatList('Forbidden changes', input.contract.forbiddenChanges),
    formatList('Acceptance criteria', input.contract.acceptanceCriteria),
    `Context pack id: ${contextPack.id}`,
    `Draft: ${draftText}`,
    'Return WritingSelfCheck JSON with summary, passed, and findings.'
  ].join('\n');
}

function formatList(label: string, values: string[]): string {
  return `${label}: ${values.length > 0 ? values.join('; ') : 'None'}`;
}

function normalizeSelfCheck(value: SelfCheckArtifact['result']): SelfCheckArtifact['result'] {
  return {
    summary: String(value.summary ?? ''),
    passed: Boolean(value.passed),
    findings: Array.isArray(value.findings) ? value.findings.map(String) : []
  };
}
