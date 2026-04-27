import { systemClock } from '../shared/clock';
import { createId, type EntityId } from '../shared/ids';

export type ProjectStatus = 'Active' | 'Archived';
export type ProjectLanguage = 'zh-CN' | 'en-US';

export interface ReaderContract {
  targetAudience: string;
  genrePromise: string;
  forbiddenDirections: string[];
}

export interface Project {
  id: EntityId<'project'>;
  title: string;
  language: ProjectLanguage;
  status: ProjectStatus;
  readerContract: ReaderContract;
  createdAt: string;
  updatedAt: string;
}

export function createProject(input: {
  title: string;
  language: ProjectLanguage;
  targetAudience: string;
  genrePromise?: string;
}): Project {
  const now = systemClock.now();

  return {
    id: createId('project'),
    title: input.title,
    language: input.language,
    status: 'Active',
    readerContract: {
      targetAudience: input.targetAudience,
      genrePromise: input.genrePromise ?? 'Sustained long-form reader satisfaction',
      forbiddenDirections: []
    },
    createdAt: now,
    updatedAt: now
  };
}
