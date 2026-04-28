import { createProject, type ExternalModelPolicy, type Project, type ProjectLanguage } from '@ai-novel/domain';

export interface ProjectServiceLike {
  create(input: { title: string; language: ProjectLanguage; targetAudience: string }): Project | Promise<Project>;
  list(): Project[] | Promise<Project[]>;
  findById(id: string): Project | null | Promise<Project | null>;
  updateExternalModelPolicy(id: string, policy: ExternalModelPolicy): Project | null | Promise<Project | null>;
}

export interface ProjectPersistence {
  save(project: Project): Promise<void>;
  list(): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  updateExternalModelPolicy?(id: string, policy: ExternalModelPolicy): Promise<Project | null>;
}

export class ProjectService implements ProjectServiceLike {
  private readonly projects = new Map<string, Project>();

  create(input: { title: string; language: ProjectLanguage; targetAudience: string }): Project {
    const project = createProject(input);
    this.projects.set(project.id, project);
    return project;
  }

  list(): Project[] {
    return [...this.projects.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  findById(id: string): Project | null {
    return this.projects.get(id) ?? null;
  }

  updateExternalModelPolicy(id: string, policy: ExternalModelPolicy): Project | null {
    const existing = this.projects.get(id);
    if (!existing) return null;

    const updated: Project = {
      ...existing,
      externalModelPolicy: policy,
      updatedAt: new Date().toISOString()
    };
    this.projects.set(id, updated);
    return updated;
  }
}

export class PersistentProjectService implements ProjectServiceLike {
  constructor(private readonly repository: ProjectPersistence) {}

  async create(input: { title: string; language: ProjectLanguage; targetAudience: string }): Promise<Project> {
    const project = createProject(input);
    await this.repository.save(project);
    return project;
  }

  async list(): Promise<Project[]> {
    return this.repository.list();
  }

  async findById(id: string): Promise<Project | null> {
    return this.repository.findById(id);
  }

  async updateExternalModelPolicy(id: string, policy: ExternalModelPolicy): Promise<Project | null> {
    if (this.repository.updateExternalModelPolicy) {
      return this.repository.updateExternalModelPolicy(id, policy);
    }

    const existing = await this.repository.findById(id);
    if (!existing) return null;
    const updated = { ...existing, externalModelPolicy: policy, updatedAt: new Date().toISOString() };
    await this.repository.save(updated);
    return updated;
  }
}
