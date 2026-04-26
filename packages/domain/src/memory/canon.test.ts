import { describe, expect, it } from 'vitest';
import { createCanonFact, transitionCanonFactStatus } from './canon';

describe('CanonFact governance', () => {
  it('rejects Canon status without source and confirmation trail', () => {
    expect(() =>
      createCanonFact({
        projectId: 'project_abc',
        text: 'The protagonist fears deep water.',
        status: 'Canon',
        sourceReferences: [],
        confirmationTrail: []
      })
    ).toThrow('Canon facts require at least one source reference');
  });

  it('allows only governed memory status transitions', () => {
    const fact = createCanonFact({
      projectId: 'project_abc',
      text: 'The protagonist fears deep water.',
      status: 'Candidate',
      sourceReferences: [{ sourceType: 'user_note', sourceId: 'note_1', citation: 'initial idea' }],
      confirmationTrail: []
    });

    const draft = transitionCanonFactStatus(fact, 'Draft', { actor: 'user', reason: 'usable working note' });
    const canon = transitionCanonFactStatus(draft, 'Canon', { actor: 'user', reason: 'confirmed in outline' });

    expect(draft.status).toBe('Draft');
    expect(canon.status).toBe('Canon');
    expect(() => transitionCanonFactStatus(canon, 'Candidate', { actor: 'user', reason: 'invalid rollback' }))
      .toThrow('Invalid memory status transition: Canon -> Candidate');
  });

  it('rejects Canon promotion when source references are missing', () => {
    const draft = createCanonFact({
      projectId: 'project_abc',
      text: 'The protagonist fears deep water.',
      status: 'Draft',
      sourceReferences: [],
      confirmationTrail: []
    });

    expect(() => transitionCanonFactStatus(draft, 'Canon', { actor: 'user', reason: 'confirmed in outline' }))
      .toThrow('Canon facts require at least one source reference');
  });

  it('requires approval for agent or system Canon promotion', () => {
    const draft = createCanonFact({
      projectId: 'project_abc',
      text: 'The protagonist fears deep water.',
      status: 'Draft',
      sourceReferences: [{ sourceType: 'user_note', sourceId: 'note_1', citation: 'initial idea' }],
      confirmationTrail: []
    });

    expect(() => transitionCanonFactStatus(draft, 'Canon', { actor: 'agent', reason: 'extracted from draft' }))
      .toThrow('Agent and system Canon promotion requires an approved approval request');

    const canon = transitionCanonFactStatus(draft, 'Canon', {
      actor: 'agent',
      reason: 'approved extraction',
      approvalStatus: 'Approved'
    });
    expect(canon.status).toBe('Canon');
  });
});
