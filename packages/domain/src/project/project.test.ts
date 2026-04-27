import { describe, expect, it } from 'vitest';
import { createProject } from './project';

describe('createProject', () => {
  it('creates a local-first novel project with reader contract defaults', () => {
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });

    expect(project.title).toBe('Long Night');
    expect(project.readerContract.targetAudience).toBe('Chinese web-novel readers');
    expect(project.status).toBe('Active');
  });
});
