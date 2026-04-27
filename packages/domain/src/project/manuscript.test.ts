import { describe, expect, it } from 'vitest';
import {
  acceptManuscriptVersion,
  addChapterToVolume,
  createChapter,
  createManuscript,
  createManuscriptVersion,
  createVolume,
  rejectManuscriptVersion
} from './manuscript';

describe('manuscript structure', () => {
  it('keeps chapter order stable inside a volume', () => {
    const volume = createVolume({ projectId: 'project_abc', title: 'Volume One', order: 1 });
    const withSecond = addChapterToVolume(volume, { title: 'Chapter 2', order: 2 });
    const withFirst = addChapterToVolume(withSecond, { title: 'Chapter 1', order: 1 });

    expect(withFirst.chapters.map((chapter) => chapter.title)).toEqual(['Chapter 1', 'Chapter 2']);
  });

  it('creates a chapter without requiring a volume', () => {
    const chapter = createChapter({ projectId: 'project_abc', title: 'Opening', order: 1 });

    expect(chapter).toMatchObject({
      projectId: 'project_abc',
      title: 'Opening',
      order: 1,
      status: 'Draft',
      versions: []
    });
    expect(chapter.volumeId).toBeUndefined();
  });

  it('uses manuscript-specific identifiers for manuscripts and chapter versions', () => {
    const manuscript = createManuscript({ projectId: 'project_abc' });
    const chapter = createChapter({ projectId: 'project_abc', title: 'Opening', order: 1 });
    const draft = createManuscriptVersion({
      chapterId: chapter.id,
      bodyArtifactId: 'artifact_body_1',
      status: 'Draft'
    });

    expect(manuscript.id).toMatch(/^manuscript_/);
    expect(draft.id).toMatch(/^manuscript_version_/);
  });

  it('creates a new chapter version without overwriting the accepted manuscript text', () => {
    const chapter = createChapter({ title: 'Chapter 1', order: 1 });
    const draft = createManuscriptVersion({
      chapterId: chapter.id,
      bodyArtifactId: 'artifact_draft',
      status: 'Draft'
    });
    const accepted = acceptManuscriptVersion(chapter, draft, { acceptedBy: 'author', reason: 'fits contract' });

    expect(accepted.currentVersionId).toBe(draft.id);
    expect(accepted.versions).toHaveLength(1);
    expect(accepted.versions[0]).toMatchObject({
      id: draft.id,
      bodyArtifactId: 'artifact_draft',
      status: 'Accepted',
      acceptedBy: 'author',
      acceptanceReason: 'fits contract'
    });
  });

  it('supersedes the prior accepted version while keeping version history and artifact pointers', () => {
    const chapter = createChapter({ projectId: 'project_abc', title: 'Opening', order: 1 });
    const firstDraft = createManuscriptVersion({
      chapterId: chapter.id,
      bodyArtifactId: 'artifact_body_1',
      status: 'Draft'
    });
    const secondDraft = createManuscriptVersion({
      chapterId: chapter.id,
      bodyArtifactId: 'artifact_body_2',
      status: 'Draft'
    });

    const firstAccepted = acceptManuscriptVersion(chapter, firstDraft, {
      acceptedBy: 'author',
      reason: 'initial version'
    });
    const secondAccepted = acceptManuscriptVersion(firstAccepted, secondDraft, {
      acceptedBy: 'author',
      reason: 'revision'
    });

    expect(secondAccepted.currentVersionId).toBe(secondDraft.id);
    expect(secondAccepted.versions.map((version) => version.status)).toEqual(['Superseded', 'Accepted']);
    expect(secondAccepted.versions.map((version) => version.bodyArtifactId)).toEqual([
      'artifact_body_1',
      'artifact_body_2'
    ]);
  });

  it('marks a chapter version as rejected without making it current', () => {
    const chapter = createChapter({ projectId: 'project_abc', title: 'Opening', order: 1 });
    const draft = createManuscriptVersion({
      chapterId: chapter.id,
      bodyArtifactId: 'artifact_body_1',
      status: 'Draft'
    });

    const rejected = rejectManuscriptVersion(chapter, draft, { rejectedBy: 'author', reason: 'tone mismatch' });

    expect(rejected.currentVersionId).toBeUndefined();
    expect(rejected.versions).toHaveLength(1);
    expect(rejected.versions[0]).toMatchObject({
      id: draft.id,
      status: 'Rejected',
      bodyArtifactId: 'artifact_body_1',
      rejectedBy: 'author',
      rejectionReason: 'tone mismatch'
    });
  });
});
