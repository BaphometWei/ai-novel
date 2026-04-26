import { createProject, type Project, type ProjectLanguage } from '@ai-novel/domain';

export class ProjectService {
  private readonly projects = new Map<string, Project>();

  create(input: { title: string; language: ProjectLanguage; targetAudience: string }): Project {
    const project = createProject(input);
    this.projects.set(project.id, project);
    return project;
  }

  findById(id: string): Project | null {
    return this.projects.get(id) ?? null;
  }
}
