import type { ArtifactStore } from '@ai-novel/artifacts';
import type {
  AddChapterVersionInput,
  ChapterRecord,
  ChapterVersionRecord,
  ChapterWithVersions,
  CreateChapterWithVersionInput,
  ResolveGovernedVersionInput,
  ManuscriptRecord
} from '@ai-novel/db';
import { createArtifactRecord, type ArtifactRecord, type EntityId, type Project } from '@ai-novel/domain';

export interface ManuscriptProjectLookup {
  findById(id: string): Project | null | Promise<Project | null>;
}

export interface ManuscriptStore {
  createManuscript(input: { projectId: string; title: string; metadata?: Record<string, unknown> }): Promise<ManuscriptRecord>;
  findByProjectId(projectId: string): Promise<ManuscriptRecord | null>;
  findChapterById(chapterId: string): Promise<ChapterRecord | null>;
  createChapterWithVersion(input: CreateChapterWithVersionInput): Promise<{ chapter: ChapterWithVersions; version: ChapterVersionRecord } | { chapter: unknown; version: ChapterVersionRecord }>;
  addChapterVersion(input: AddChapterVersionInput): Promise<ChapterVersionRecord>;
  resolveGovernedVersion?(input: ResolveGovernedVersionInput): Promise<ChapterVersionRecord | null>;
  listChapters(manuscriptId: string): Promise<ChapterWithVersions[]>;
}

export interface ManuscriptArtifactStore {
  save(artifact: ArtifactRecord): Promise<void>;
  findById(id: string): Promise<ArtifactRecord | null>;
  findByHash(hash: string): Promise<ArtifactRecord | null>;
}

export interface CreateProjectChapterInput {
  title: string;
  order: number;
  bodyArtifactId?: string;
  body?: string;
  status?: ChapterVersionRecord['status'];
  metadata?: Record<string, unknown>;
}

export interface CreateChapterVersionInput {
  bodyArtifactId?: string;
  body?: string;
  status?: ChapterVersionRecord['status'];
  metadata?: Record<string, unknown>;
  makeCurrent?: boolean;
}

export class ManuscriptService {
  constructor(
    private readonly projects: ManuscriptProjectLookup,
    private readonly manuscripts: ManuscriptStore,
    private readonly artifacts?: ManuscriptArtifactStore,
    private readonly artifactContent?: ArtifactStore
  ) {}

  async listProjectChapters(projectId: EntityId<'project'>): Promise<ChapterWithVersions[] | null> {
    const project = await this.projects.findById(projectId);
    if (!project) return null;

    const manuscript = await this.manuscripts.findByProjectId(projectId);
    if (!manuscript) return [];
    return this.manuscripts.listChapters(manuscript.id);
  }

  async getCurrentChapterBody(
    chapterId: EntityId<'chapter'>
  ): Promise<{ chapterId: string; versionId: string; body: string } | null> {
    if (!this.artifacts || !this.artifactContent) return null;

    const chapter = await this.manuscripts.findChapterById(chapterId);
    if (!chapter?.currentVersionId) return null;

    const chapters = await this.manuscripts.listChapters(chapter.manuscriptId);
    const currentVersion = chapters
      .find((candidate) => candidate.id === chapter.id)
      ?.versions.find((version) => version.id === chapter.currentVersionId);
    if (!currentVersion) return null;

    const artifact = await this.artifacts.findById(currentVersion.bodyArtifactId);
    if (!artifact) return null;

    try {
      const body = await this.artifactContent.readText(artifact.uri);
      return { chapterId: chapter.id, versionId: currentVersion.id, body };
    } catch {
      return null;
    }
  }

  async findChapterById(chapterId: EntityId<'chapter'>): Promise<ChapterRecord | null> {
    return this.manuscripts.findChapterById(chapterId);
  }

  async getProjectVersionBody(
    projectId: EntityId<'project'>,
    versionId: EntityId<'manuscript_version'>
  ): Promise<{ chapterId: string; versionId: string; body: string; status: string } | null> {
    if (!this.artifacts || !this.artifactContent) return null;

    const manuscript = await this.manuscripts.findByProjectId(projectId);
    if (!manuscript) return null;

    const chapters = await this.manuscripts.listChapters(manuscript.id);
    for (const chapter of chapters) {
      const version = chapter.versions.find((candidate) => candidate.id === versionId);
      if (!version) continue;

      const artifact = await this.artifacts.findById(version.bodyArtifactId);
      if (!artifact) return null;

      return {
        chapterId: chapter.id,
        versionId: version.id,
        body: await this.artifactContent.readText(artifact.uri),
        status: version.status
      };
    }

    return null;
  }

  async createProjectChapter(projectId: EntityId<'project'>, input: CreateProjectChapterInput) {
    const project = await this.projects.findById(projectId);
    if (!project) return null;

    const manuscript = await this.findOrCreateDefaultManuscript(project);
    const bodyArtifactId = await this.resolveBodyArtifactId({
      body: input.body,
      bodyArtifactId: input.bodyArtifactId,
      name: `${project.id}-${input.title}-v1.md`,
      source: 'user'
    });
    return this.manuscripts.createChapterWithVersion({
      manuscriptId: manuscript.id,
      title: input.title,
      order: input.order,
      bodyArtifactId,
      status: input.status,
      metadata: input.metadata
    });
  }

  async addChapterVersion(chapterId: EntityId<'chapter'>, input: CreateChapterVersionInput): Promise<ChapterVersionRecord> {
    if (input.body && !input.bodyArtifactId) {
      const chapter = await this.manuscripts.findChapterById(chapterId);
      if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);
    }
    const bodyArtifactId = await this.resolveBodyArtifactId({
      body: input.body,
      bodyArtifactId: input.bodyArtifactId,
      name: `${chapterId}-revision.md`,
      source: 'user'
    });
    return this.manuscripts.addChapterVersion({
      chapterId,
      bodyArtifactId,
      status: input.status,
      metadata: input.metadata,
      makeCurrent: input.makeCurrent
    });
  }

  async resolveGovernedVersion(input: ResolveGovernedVersionInput): Promise<ChapterVersionRecord | null> {
    if (!this.manuscripts.resolveGovernedVersion) {
      throw new Error('Governed manuscript version resolution is not configured');
    }

    return this.manuscripts.resolveGovernedVersion(input);
  }

  private async findOrCreateDefaultManuscript(project: Project): Promise<ManuscriptRecord> {
    const existing = await this.manuscripts.findByProjectId(project.id);
    if (existing) return existing;

    return this.manuscripts.createManuscript({
      projectId: project.id,
      title: `${project.title} Manuscript`,
      metadata: { default: true }
    });
  }

  private async resolveBodyArtifactId(input: {
    body?: string;
    bodyArtifactId?: string;
    name: string;
    source: ArtifactRecord['source'];
  }): Promise<string> {
    if (input.bodyArtifactId) return input.bodyArtifactId;
    if (!input.body) throw new Error('Body artifact is required');
    if (!this.artifacts || !this.artifactContent) {
      throw new Error('Artifact content store is not configured');
    }

    const stored = await this.artifactContent.writeText(input.name, input.body);
    const existing = await this.artifacts.findByHash(stored.hash);
    if (existing) return existing.id;

    const artifact = createArtifactRecord({
      type: 'manuscript_version',
      source: input.source,
      version: 1,
      hash: stored.hash,
      uri: stored.uri
    });
    await this.artifacts.save(artifact);
    return artifact.id;
  }
}
