import { createApprovalRequest, createCanonFact, createProject, transitionCanonFactStatus } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { MemoryRepository } from '../repositories/memory.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('MemoryRepository', () => {
  it('persists canon facts with sources confirmation trail and ledger', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new MemoryRepository(database.db);
    const candidate = createCanonFact({
      projectId: project.id,
      text: 'The protagonist fears deep water.',
      status: 'Candidate',
      sourceReferences: [{ sourceType: 'user_note', sourceId: 'note_1', citation: 'initial idea' }],
      confirmationTrail: []
    });
    const draft = transitionCanonFactStatus(candidate, 'Draft', { actor: 'user', reason: 'usable note' });
    const canon = transitionCanonFactStatus(draft, 'Canon', { actor: 'user', reason: 'confirmed outline' });

    await repository.saveCanonFact(canon);

    await expect(repository.findCanonFactById(canon.id)).resolves.toMatchObject({
      id: canon.id,
      status: 'Canon',
      sourceReferences: [{ sourceType: 'user_note', sourceId: 'note_1', citation: 'initial idea' }]
    });
    database.client.close();
  });

  it('persists approval requests for high-risk memory changes', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new MemoryRepository(database.db);
    const request = createApprovalRequest({
      projectId: project.id,
      targetType: 'CanonFact',
      targetId: 'canon_fact_abc',
      riskLevel: 'High',
      reason: 'Changes protagonist backstory',
      proposedAction: 'Promote draft memory to canon'
    });

    await repository.saveApprovalRequest(request);

    await expect(repository.findApprovalRequestById(request.id)).resolves.toMatchObject({
      id: request.id,
      status: 'Pending',
      riskLevel: 'High'
    });
    database.client.close();
  });

  it('rejects project-scoped memory rows for missing projects', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new MemoryRepository(database.db);
    const candidate = createCanonFact({
      projectId: 'project_missing',
      text: 'The protagonist fears deep water.',
      status: 'Candidate',
      sourceReferences: [{ sourceType: 'user_note', sourceId: 'note_1', citation: 'initial idea' }],
      confirmationTrail: []
    });

    await expect(repository.saveCanonFact(candidate)).rejects.toThrow();
    database.client.close();
  });
});
