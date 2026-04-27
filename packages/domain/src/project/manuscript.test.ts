import { describe, expect, it } from 'vitest';
import { addChapterToVolume, createVolume } from './manuscript';

describe('manuscript structure', () => {
  it('keeps chapter order stable inside a volume', () => {
    const volume = createVolume({ projectId: 'project_abc', title: 'Volume One', order: 1 });
    const withSecond = addChapterToVolume(volume, { title: 'Chapter 2', order: 2 });
    const withFirst = addChapterToVolume(withSecond, { title: 'Chapter 1', order: 1 });

    expect(withFirst.chapters.map((chapter) => chapter.title)).toEqual(['Chapter 1', 'Chapter 2']);
  });
});
