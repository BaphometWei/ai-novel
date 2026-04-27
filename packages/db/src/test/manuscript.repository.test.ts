import { createArtifactRecord, createProject } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ArtifactRepository } from '../repositories/artifact.repository';
import { createManuscriptRepository } from '../repositories/manuscript.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('ManuscriptRepository', () => {
  it('persists manuscripts, chapters, and ordered chapter versions for a project', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projects = new ProjectRepository(database.db);
    const artifacts = new ArtifactRepository(database.db);
    const repository = createManuscriptRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const firstBody = createArtifactRecord({
      type: 'manuscript_version',
      source: 'user',
      version: 1,
      hash: 'sha256:chapter-opening-v1',
      uri: 'artifacts/chapter-opening-v1.md'
    });
    const secondBody = createArtifactRecord({
      type: 'manuscript_version',
      source: 'agent_run',
      version: 2,
      hash: 'sha256:chapter-opening-v2',
      uri: 'artifacts/chapter-opening-v2.md'
    });

    await projects.save(project);
    await artifacts.save(firstBody);
    await artifacts.save(secondBody);
    const manuscript = await repository.createManuscript({
      projectId: project.id,
      title: 'Long Night Manuscript',
      metadata: { outlineArtifactId: 'artifact_outline' }
    });
    const saved = await repository.createChapterWithVersion({
      manuscriptId: manuscript.id,
      title: 'Opening',
      order: 1,
      bodyArtifactId: firstBody.id,
      status: 'Draft',
      metadata: { source: 'import' }
    });
    const accepted = await repository.addChapterVersion({
      chapterId: saved.chapter.id,
      bodyArtifactId: secondBody.id,
      status: 'Accepted',
      metadata: { acceptedBy: 'author' },
      makeCurrent: true
    });

    const chapters = await repository.listChapters(manuscript.id);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]).toMatchObject({
      id: saved.chapter.id,
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: 'Opening',
      order: 1,
      currentVersionId: accepted.id
    });
    expect(saved.version.id).toMatch(/^manuscript_version_/);
    expect(accepted.id).toMatch(/^manuscript_version_/);
    expect(chapters[0]?.versions.map((version) => version.id)).toEqual([
      saved.version.id,
      accepted.id
    ]);
    expect(chapters[0]?.versions.map((version) => version.status)).toEqual([
      'Draft',
      'Accepted'
    ]);
    expect(chapters[0]?.versions[1]).toMatchObject({
      bodyArtifactId: secondBody.id,
      versionNumber: 2,
      metadata: { acceptedBy: 'author' }
    });
    database.client.close();
  });

  it('enforces project and body artifact foreign keys', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projects = new ProjectRepository(database.db);
    const artifacts = new ArtifactRepository(database.db);
    const repository = createManuscriptRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const body = createArtifactRecord({
      type: 'manuscript_version',
      source: 'user',
      version: 1,
      hash: 'sha256:chapter-opening-fk',
      uri: 'artifacts/chapter-opening-fk.md'
    });

    await expect(
      repository.createManuscript({
        projectId: project.id,
        title: 'Orphan Manuscript'
      })
    ).rejects.toThrow();

    await projects.save(project);
    const manuscript = await repository.createManuscript({
      projectId: project.id,
      title: 'Long Night Manuscript'
    });

    await expect(
      repository.createChapterWithVersion({
        manuscriptId: manuscript.id,
        title: 'Opening',
        order: 1,
        bodyArtifactId: body.id
      })
    ).rejects.toThrow();
    await expect(repository.listChapters(manuscript.id)).resolves.toEqual([]);

    await artifacts.save(body);
    await expect(
      repository.createChapterWithVersion({
        manuscriptId: manuscript.id,
        title: 'Opening',
        order: 1,
        bodyArtifactId: body.id
      })
    ).resolves.toMatchObject({
      chapter: { currentVersionId: expect.any(String) },
      version: { bodyArtifactId: body.id, status: 'Draft' }
    });
    database.client.close();
  });

  it('supersedes the previous accepted chapter version when a new accepted version becomes current', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projects = new ProjectRepository(database.db);
    const artifacts = new ArtifactRepository(database.db);
    const repository = createManuscriptRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const firstBody = createArtifactRecord({
      type: 'manuscript_version',
      source: 'user',
      version: 1,
      hash: 'sha256:chapter-accepted-v1',
      uri: 'artifacts/chapter-accepted-v1.md'
    });
    const secondBody = createArtifactRecord({
      type: 'manuscript_version',
      source: 'user',
      version: 2,
      hash: 'sha256:chapter-accepted-v2',
      uri: 'artifacts/chapter-accepted-v2.md'
    });

    await projects.save(project);
    await artifacts.save(firstBody);
    await artifacts.save(secondBody);
    const manuscript = await repository.createManuscript({
      projectId: project.id,
      title: 'Long Night Manuscript'
    });
    const initial = await repository.createChapterWithVersion({
      manuscriptId: manuscript.id,
      title: 'Opening',
      order: 1,
      bodyArtifactId: firstBody.id,
      status: 'Accepted'
    });
    const current = await repository.addChapterVersion({
      chapterId: initial.chapter.id,
      bodyArtifactId: secondBody.id,
      status: 'Accepted',
      makeCurrent: true
    });

    const chapters = await repository.listChapters(manuscript.id);

    expect(chapters[0]?.currentVersionId).toBe(current.id);
    expect(chapters[0]?.versions.map((version) => version.status)).toEqual([
      'Superseded',
      'Accepted'
    ]);
    database.client.close();
  });

  it('rejects current pointers that would make rejected or superseded versions current', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projects = new ProjectRepository(database.db);
    const artifacts = new ArtifactRepository(database.db);
    const repository = createManuscriptRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const body = createArtifactRecord({
      type: 'manuscript_version',
      source: 'user',
      version: 1,
      hash: 'sha256:chapter-rejected-current',
      uri: 'artifacts/chapter-rejected-current.md'
    });

    await projects.save(project);
    await artifacts.save(body);
    const manuscript = await repository.createManuscript({
      projectId: project.id,
      title: 'Long Night Manuscript'
    });
    const initial = await repository.createChapterWithVersion({
      manuscriptId: manuscript.id,
      title: 'Opening',
      order: 1,
      bodyArtifactId: body.id
    });

    await expect(
      repository.addChapterVersion({
        chapterId: initial.chapter.id,
        bodyArtifactId: body.id,
        status: 'Rejected',
        makeCurrent: true
      })
    ).rejects.toThrow('Rejected versions cannot become current');
    await expect(
      repository.addChapterVersion({
        chapterId: initial.chapter.id,
        bodyArtifactId: body.id,
        status: 'Accepted',
        makeCurrent: false
      })
    ).rejects.toThrow('Accepted versions must become current');
    database.client.close();
  });

  it('does not persist a chapter when initial version status is invalid for the current pointer', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projects = new ProjectRepository(database.db);
    const artifacts = new ArtifactRepository(database.db);
    const repository = createManuscriptRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const body = createArtifactRecord({
      type: 'manuscript_version',
      source: 'user',
      version: 1,
      hash: 'sha256:chapter-invalid-initial',
      uri: 'artifacts/chapter-invalid-initial.md'
    });

    await projects.save(project);
    await artifacts.save(body);
    const manuscript = await repository.createManuscript({
      projectId: project.id,
      title: 'Long Night Manuscript'
    });

    await expect(
      repository.createChapterWithVersion({
        manuscriptId: manuscript.id,
        title: 'Opening',
        order: 1,
        bodyArtifactId: body.id,
        status: 'Rejected'
      })
    ).rejects.toThrow('Rejected versions cannot become current');
    await expect(repository.listChapters(manuscript.id)).resolves.toEqual([]);
    database.client.close();
  });

  it('rolls back the chapter when the initial version insert fails', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projects = new ProjectRepository(database.db);
    const artifacts = new ArtifactRepository(database.db);
    const repository = createManuscriptRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const body = createArtifactRecord({
      type: 'manuscript_version',
      source: 'user',
      version: 1,
      hash: 'sha256:chapter-version-insert-failure',
      uri: 'artifacts/chapter-version-insert-failure.md'
    });

    await projects.save(project);
    await artifacts.save(body);
    const manuscript = await repository.createManuscript({
      projectId: project.id,
      title: 'Long Night Manuscript'
    });

    await expect(
      repository.createChapterWithVersion({
        manuscriptId: manuscript.id,
        title: 'Opening',
        order: 1,
        bodyArtifactId: body.id,
        status: 'Archived' as never
      })
    ).rejects.toThrow();
    await expect(repository.listChapters(manuscript.id)).resolves.toEqual([]);
    database.client.close();
  });
});
