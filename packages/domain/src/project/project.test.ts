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
    expect(project.externalModelPolicy).toBe('Allowed');
  });

  it('can create a project that disables external model use', () => {
    const project = createProject({
      title: 'Offline Draft',
      language: 'en-US',
      targetAudience: 'local-only authors',
      externalModelPolicy: 'Disabled'
    });

    expect(project.externalModelPolicy).toBe('Disabled');
  });
});
