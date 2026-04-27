import { createProject } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { NarrativeStateRepository, type NarrativeStateRecord } from '../repositories/narrative-state.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('NarrativeStateRepository', () => {
  it('upserts inspectable narrative state records by id', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new NarrativeStateRepository(database.db);
    const record: NarrativeStateRecord = {
      id: 'promise_opening_rescue',
      projectId: project.id,
      type: 'promise',
      payload: {
        text: 'The missing sister will be found before winter.',
        status: 'open',
        introducedInChapterId: 'chapter_1'
      },
      snapshotVersion: 1,
      snapshotMetadata: [
        {
          version: 1,
          source: 'outline_import',
          sourceId: 'outline_v1',
          createdAt: '2026-04-27T08:00:00.000Z'
        }
      ],
      createdAt: '2026-04-27T08:00:00.000Z',
      updatedAt: '2026-04-27T08:00:00.000Z'
    };

    await repository.upsert(record);
    await repository.upsert({
      ...record,
      payload: {
        ...(record.payload as Record<string, unknown>),
        status: 'complicated',
        latestChapterId: 'chapter_3'
      },
      snapshotVersion: 2,
      snapshotMetadata: [
        ...record.snapshotMetadata,
        {
          version: 2,
          source: 'revision_pass',
          sourceId: 'run_17',
          createdAt: '2026-04-27T09:00:00.000Z'
        }
      ],
      updatedAt: '2026-04-27T09:00:00.000Z'
    });

    await expect(repository.getById(record.id)).resolves.toEqual({
      ...record,
      payload: {
        text: 'The missing sister will be found before winter.',
        status: 'complicated',
        introducedInChapterId: 'chapter_1',
        latestChapterId: 'chapter_3'
      },
      snapshotVersion: 2,
      snapshotMetadata: [
        {
          version: 1,
          source: 'outline_import',
          sourceId: 'outline_v1',
          createdAt: '2026-04-27T08:00:00.000Z'
        },
        {
          version: 2,
          source: 'revision_pass',
          sourceId: 'run_17',
          createdAt: '2026-04-27T09:00:00.000Z'
        }
      ],
      updatedAt: '2026-04-27T09:00:00.000Z'
    });
    database.client.close();
  });

  it('lists project records by narrative state type without leaking other projects or types', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const firstProject = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const secondProject = createProject({
      title: 'Bright Archive',
      language: 'en-US',
      targetAudience: 'Serial fantasy readers'
    });
    await new ProjectRepository(database.db).save(firstProject);
    await new ProjectRepository(database.db).save(secondProject);
    const repository = new NarrativeStateRepository(database.db);

    await repository.upsert(createRecord({ id: 'secret_first', projectId: firstProject.id, type: 'secret' }));
    await repository.upsert(createRecord({ id: 'arc_first', projectId: firstProject.id, type: 'arc' }));
    await repository.upsert(createRecord({ id: 'secret_second', projectId: secondProject.id, type: 'secret' }));

    await expect(repository.listByProjectAndType(firstProject.id, 'secret')).resolves.toMatchObject([
      { id: 'secret_first', projectId: firstProject.id, type: 'secret' }
    ]);
    database.client.close();
  });

  it('appends snapshot metadata while preserving JSON payloads for V3 narrative state categories', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new NarrativeStateRepository(database.db);
    const records: NarrativeStateRecord[] = [
      createRecord({ id: 'promise_1', projectId: project.id, type: 'promise' }),
      createRecord({ id: 'secret_1', projectId: project.id, type: 'secret' }),
      createRecord({ id: 'arc_1', projectId: project.id, type: 'arc' }),
      createRecord({ id: 'timeline_1', projectId: project.id, type: 'timeline_event' }),
      createRecord({ id: 'world_rule_1', projectId: project.id, type: 'world_rule' }),
      createRecord({ id: 'dependency_finding_1', projectId: project.id, type: 'dependency_finding' }),
      createRecord({ id: 'source_metadata_1', projectId: project.id, type: 'source_metadata' })
    ];

    for (const record of records) {
      await repository.upsert(record);
    }
    await repository.appendSnapshotMetadata('dependency_finding_1', {
      version: 2,
      source: 'dependency_scan',
      sourceId: 'scan_42',
      note: 'Linked reveal depends on chapter_8',
      createdAt: '2026-04-27T11:00:00.000Z'
    });

    await expect(repository.listByProject(project.id)).resolves.toHaveLength(7);
    await expect(repository.getById('dependency_finding_1')).resolves.toMatchObject({
      id: 'dependency_finding_1',
      projectId: project.id,
      type: 'dependency_finding',
      payload: {
        label: 'dependency_finding_1',
        sourceRefs: [{ sourceType: 'test', sourceId: 'fixture' }]
      },
      snapshotVersion: 2,
      snapshotMetadata: [
        {
          version: 1,
          source: 'test_fixture',
          sourceId: 'fixture',
          createdAt: '2026-04-27T10:00:00.000Z'
        },
        {
          version: 2,
          source: 'dependency_scan',
          sourceId: 'scan_42',
          note: 'Linked reveal depends on chapter_8',
          createdAt: '2026-04-27T11:00:00.000Z'
        }
      ],
      updatedAt: '2026-04-27T11:00:00.000Z'
    });
    database.client.close();
  });

  it('rejects records for missing projects', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new NarrativeStateRepository(database.db);

    await expect(repository.upsert(createRecord({ id: 'orphan', projectId: 'project_missing', type: 'promise' }))).rejects.toThrow();
    database.client.close();
  });
});

function createRecord(input: {
  id: string;
  projectId: string;
  type: NarrativeStateRecord['type'];
}): NarrativeStateRecord {
  return {
    id: input.id,
    projectId: input.projectId,
    type: input.type,
    payload: {
      label: input.id,
      sourceRefs: [{ sourceType: 'test', sourceId: 'fixture' }]
    },
    snapshotVersion: 1,
    snapshotMetadata: [
      {
        version: 1,
        source: 'test_fixture',
        sourceId: 'fixture',
        createdAt: '2026-04-27T10:00:00.000Z'
      }
    ],
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:00:00.000Z'
  };
}
