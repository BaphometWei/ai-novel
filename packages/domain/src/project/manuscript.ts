import { createId, type EntityId } from '../shared/ids';

export type ChapterStatus = 'Draft' | 'Review' | 'Ready' | 'Published';

export interface Chapter {
  id: EntityId<'chapter'>;
  projectId: EntityId<'project'>;
  volumeId: EntityId<'volume'>;
  title: string;
  order: number;
  status: ChapterStatus;
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

export function addChapterToVolume(volume: Volume, input: { title: string; order: number }): Volume {
  const chapter: Chapter = {
    id: createId('chapter'),
    projectId: volume.projectId,
    volumeId: volume.id,
    title: input.title,
    order: input.order,
    status: 'Draft'
  };

  return {
    ...volume,
    chapters: [...volume.chapters, chapter].sort((left, right) => left.order - right.order)
  };
}
