import { createKnowledgeItem, createProject, createSourcePolicy } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('KnowledgeRepository', () => {
  it('persists knowledge items and returns generation source exclusions', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projectRepository = new ProjectRepository(database.db);
    const knowledgeRepository = new KnowledgeRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await projectRepository.save(project);
    const ownedPolicy = createSourcePolicy({
      sourceType: 'user_note',
      allowedUse: ['generation_support'],
      prohibitedUse: [],
      attributionRequirements: 'none',
      licenseNotes: 'owned',
      similarityRisk: 'Low'
    });
    const restrictedPolicy = createSourcePolicy({
      sourceType: 'web_excerpt',
      allowedUse: ['analysis'],
      prohibitedUse: ['generation_support'],
      attributionRequirements: 'cite source',
      licenseNotes: 'unknown',
      similarityRisk: 'High'
    });
    const owned = createKnowledgeItem({
      title: 'Owned setting note',
      kind: 'WorldTemplate',
      lifecycleStatus: 'Active',
      material: { sourceTitle: 'Author note', sourcePolicy: ownedPolicy, extractedSummary: 'A floating archive city.' },
      tags: ['world']
    });
    const restricted = createKnowledgeItem({
      title: 'Sample fight cadence',
      kind: 'Sample',
      lifecycleStatus: 'Active',
      material: { sourceTitle: 'Web excerpt', sourcePolicy: restrictedPolicy, extractedSummary: 'Punchy cadence sample.' },
      tags: ['style']
    });

    await knowledgeRepository.saveKnowledgeItem(project.id, owned);
    await knowledgeRepository.saveKnowledgeItem(project.id, restricted);

    const context = await knowledgeRepository.buildGenerationSourceContext(project.id);

    expect(context.included.map((item) => item.title)).toEqual(['Owned setting note']);
    expect(context.exclusions).toEqual([
      { knowledgeItemId: restricted.id, reason: 'Source policy prohibits generation support' }
    ]);
    database.client.close();
  });
});
