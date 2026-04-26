import { createId, type EntityId } from '@ai-novel/domain';

export type AuthorshipLevel = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type DraftArtifactStatus = 'Draft' | 'Accepted' | 'Rejected';

export interface WritingContract {
  id: string;
  projectId: EntityId<'project'>;
  authorshipLevel: AuthorshipLevel;
  targetRange: string;
  mustWrite: string;
  wordRange: { min: number; max: number };
  forbiddenChanges: string[];
}

export interface AuthorshipSession {
  id: string;
  writingContract: WritingContract;
  draftArtifacts: Array<{ artifactId: string; status: DraftArtifactStatus }>;
}

export function createAuthorshipSession(input: {
  projectId: EntityId<'project'>;
  authorshipLevel: AuthorshipLevel;
  targetRange: string;
  mustWrite: string;
  wordRange: { min: number; max: number };
  forbiddenChanges: string[];
}): AuthorshipSession {
  if (input.authorshipLevel === 'A0') {
    throw new Error('A0 author-led sessions do not create agent writing contracts');
  }

  return {
    id: `authorship_session_${createId('agent_run').slice('agent_run_'.length)}`,
    writingContract: {
      id: `writing_contract_${createId('agent_run').slice('agent_run_'.length)}`,
      ...input
    },
    draftArtifacts: []
  };
}

export function acceptDraftArtifact(session: AuthorshipSession, artifactId: string): AuthorshipSession {
  return {
    ...session,
    draftArtifacts: session.draftArtifacts.map((artifact) =>
      artifact.artifactId === artifactId ? { ...artifact, status: 'Accepted' } : artifact
    )
  };
}
