import { describe, expect, it } from 'vitest';
import { acceptDraftArtifact, createAuthorshipSession } from './authorship';

describe('Authorship Control', () => {
  it('creates a WritingContract before A1-A4 draft generation', () => {
    const session = createAuthorshipSession({
      projectId: 'project_abc',
      authorshipLevel: 'A3',
      targetRange: 'chapter_1',
      mustWrite: 'Draft chapter one',
      wordRange: { min: 2500, max: 3500 },
      forbiddenChanges: ['Do not kill the protagonist']
    });

    expect(session.writingContract.authorshipLevel).toBe('A3');
    expect(session.draftArtifacts).toEqual([]);
  });

  it('keeps agent prose as draft until the user accepts it', () => {
    const session = createAuthorshipSession({
      projectId: 'project_abc',
      authorshipLevel: 'A2',
      targetRange: 'scene_1',
      mustWrite: 'Draft the confrontation scene',
      wordRange: { min: 800, max: 1200 },
      forbiddenChanges: []
    });
    const withAccepted = acceptDraftArtifact(
      { ...session, draftArtifacts: [{ artifactId: 'artifact_draft', status: 'Draft' }] },
      'artifact_draft'
    );

    expect(withAccepted.draftArtifacts[0].status).toBe('Accepted');
  });
});
