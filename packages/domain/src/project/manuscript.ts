import { createId, type EntityId } from '../shared/ids';

export type ChapterStatus = 'Draft' | 'Review' | 'Ready' | 'Published';
export type ManuscriptVersionStatus = 'Draft' | 'Accepted' | 'Rejected' | 'Superseded';

export interface Manuscript {
  id: EntityId<'manuscript'>;
  projectId: EntityId<'project'>;
  chapters: Chapter[];
}

export interface ManuscriptVersion {
  id: EntityId<'manuscript_version'>;
  chapterId: EntityId<'chapter'>;
  bodyArtifactId: EntityId<'artifact'>;
  status: ManuscriptVersionStatus;
  acceptedBy?: string;
  acceptanceReason?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface Chapter {
  id: EntityId<'chapter'>;
  projectId?: EntityId<'project'>;
  volumeId?: EntityId<'volume'>;
  title: string;
  order: number;
  status: ChapterStatus;
  currentVersionId?: EntityId<'manuscript_version'>;
  versions: ManuscriptVersion[];
}

export interface Volume {
  id: EntityId<'volume'>;
  projectId: EntityId<'project'>;
  title: string;
  order: number;
  chapters: Chapter[];
}

export function createVolume(input: {
  projectId: EntityId<'project'>;
  title: string;
  order: number;
}): Volume {
  return {
    id: createId('volume'),
    projectId: input.projectId,
    title: input.title,
    order: input.order,
    chapters: []
  };
}

export function createManuscript(input: { projectId: EntityId<'project'> }): Manuscript {
  return {
    id: createId('manuscript'),
    projectId: input.projectId,
    chapters: []
  };
}

export function createChapter(input: {
  projectId?: EntityId<'project'>;
  volumeId?: EntityId<'volume'>;
  title: string;
  order: number;
}): Chapter {
  return {
    id: createId('chapter'),
    projectId: input.projectId,
    volumeId: input.volumeId,
    title: input.title,
    order: input.order,
    status: 'Draft',
    versions: []
  };
}

export function addChapterToVolume(volume: Volume, input: { title: string; order: number }): Volume {
  const chapter = createChapter({
    projectId: volume.projectId,
    volumeId: volume.id,
    title: input.title,
    order: input.order
  });

  return {
    ...volume,
    chapters: [...volume.chapters, chapter].sort((left, right) => left.order - right.order)
  };
}

export function createManuscriptVersion(input: {
  chapterId: EntityId<'chapter'>;
  bodyArtifactId: EntityId<'artifact'>;
  status: ManuscriptVersionStatus;
}): ManuscriptVersion {
  return {
    id: createId('manuscript_version'),
    chapterId: input.chapterId,
    bodyArtifactId: input.bodyArtifactId,
    status: input.status
  };
}

export function acceptManuscriptVersion(
  chapter: Chapter,
  version: ManuscriptVersion,
  decision: { acceptedBy: string; reason: string }
): Chapter {
  const acceptedVersion: ManuscriptVersion = {
    ...version,
    status: 'Accepted',
    acceptedBy: decision.acceptedBy,
    acceptanceReason: decision.reason
  };

  const versions = chapter.versions.map((existing) =>
    existing.id === chapter.currentVersionId && existing.status === 'Accepted'
      ? { ...existing, status: 'Superseded' as const }
      : existing
  );

  return {
    ...chapter,
    currentVersionId: acceptedVersion.id,
    versions: upsertVersion(versions, acceptedVersion)
  };
}

export function rejectManuscriptVersion(
  chapter: Chapter,
  version: ManuscriptVersion,
  decision: { rejectedBy: string; reason: string }
): Chapter {
  const rejectedVersion: ManuscriptVersion = {
    ...version,
    status: 'Rejected',
    rejectedBy: decision.rejectedBy,
    rejectionReason: decision.reason
  };

  return {
    ...chapter,
    versions: upsertVersion(chapter.versions, rejectedVersion)
  };
}

function upsertVersion(versions: ManuscriptVersion[], version: ManuscriptVersion): ManuscriptVersion[] {
  const existingIndex = versions.findIndex((existing) => existing.id === version.id);
  if (existingIndex === -1) {
    return [...versions, version];
  }

  return versions.map((existing) => (existing.id === version.id ? version : existing));
}
