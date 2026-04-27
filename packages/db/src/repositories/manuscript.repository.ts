import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { artifacts, chapterVersions, chapters, manuscripts } from '../schema';

export type ChapterVersionStatus = 'Draft' | 'Accepted' | 'Rejected' | 'Superseded';

export interface ManuscriptRecord {
  id: string;
  projectId: string;
  title: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterRecord {
  id: string;
  manuscriptId: string;
  projectId: string;
  title: string;
  order: number;
  status: string;
  currentVersionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterVersionRecord {
  id: string;
  chapterId: string;
  bodyArtifactId: string;
  versionNumber: number;
  status: ChapterVersionStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type ChapterWithVersions = ChapterRecord & { versions: ChapterVersionRecord[] };

type DatabaseLike = AppDatabase;

export interface CreateManuscriptInput {
  projectId: string;
  title: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateChapterWithVersionInput {
  manuscriptId: string;
  title: string;
  order: number;
  bodyArtifactId: string;
  status?: ChapterVersionStatus;
  chapterStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface AddChapterVersionInput {
  chapterId: string;
  bodyArtifactId: string;
  status?: ChapterVersionStatus;
  metadata?: Record<string, unknown>;
  makeCurrent?: boolean;
}

export class ManuscriptRepository {
  constructor(private readonly db: AppDatabase) {}

  async createManuscript(input: CreateManuscriptInput): Promise<ManuscriptRecord> {
    const now = new Date().toISOString();
    const manuscript: ManuscriptRecord = {
      id: createRepositoryId('manuscript'),
      projectId: input.projectId,
      title: input.title,
      status: input.status ?? 'Active',
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now
    };

    await this.db.insert(manuscripts).values({
      id: manuscript.id,
      projectId: manuscript.projectId,
      title: manuscript.title,
      status: manuscript.status,
      metadataJson: JSON.stringify(manuscript.metadata),
      createdAt: manuscript.createdAt,
      updatedAt: manuscript.updatedAt
    });

    return manuscript;
  }

  async findByProjectId(projectId: string): Promise<ManuscriptRecord | null> {
    const row = await this.db
      .select()
      .from(manuscripts)
      .where(eq(manuscripts.projectId, projectId))
      .orderBy(asc(manuscripts.createdAt))
      .get();
    if (!row) return null;

    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      status: row.status,
      metadata: JSON.parse(row.metadataJson) as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async findChapterById(chapterId: string): Promise<ChapterRecord | null> {
    const row = await this.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .get();
    if (!row) return null;

    return {
      id: row.id,
      manuscriptId: row.manuscriptId,
      projectId: row.projectId,
      title: row.title,
      order: row.order,
      status: row.status,
      currentVersionId: row.currentVersionId,
      metadata: JSON.parse(row.metadataJson) as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async createChapterWithVersion(
    input: CreateChapterWithVersionInput
  ): Promise<{ chapter: ChapterRecord; version: ChapterVersionRecord }> {
    const initialStatus = input.status ?? 'Draft';
    if (initialStatus === 'Rejected' || initialStatus === 'Superseded') {
      throw new Error(`${initialStatus} versions cannot become current`);
    }
    const manuscript = await this.db
      .select()
      .from(manuscripts)
      .where(eq(manuscripts.id, input.manuscriptId))
      .get();

    if (!manuscript) {
      throw new Error(`Manuscript not found: ${input.manuscriptId}`);
    }

    await this.expectBodyArtifact(input.bodyArtifactId, this.db);

    const now = new Date().toISOString();
    const chapter: ChapterRecord = {
      id: createRepositoryId('chapter'),
      manuscriptId: input.manuscriptId,
      projectId: manuscript.projectId,
      title: input.title,
      order: input.order,
      status: input.chapterStatus ?? 'Draft',
      currentVersionId: null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now
    };

    const version = await this.withTransaction(async () => {
      await this.db.insert(chapters).values({
        id: chapter.id,
        manuscriptId: chapter.manuscriptId,
        projectId: chapter.projectId,
        title: chapter.title,
        order: chapter.order,
        status: chapter.status,
        currentVersionId: chapter.currentVersionId,
        metadataJson: JSON.stringify(chapter.metadata),
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt
      });

      return this.addChapterVersionInDatabase(this.db, {
        chapterId: chapter.id,
        bodyArtifactId: input.bodyArtifactId,
        status: initialStatus,
        metadata: input.metadata,
        makeCurrent: true
      });
    });

    return {
      chapter: { ...chapter, currentVersionId: version.id, updatedAt: version.createdAt },
      version
    };
  }

  async addChapterVersion(input: AddChapterVersionInput): Promise<ChapterVersionRecord> {
    return this.addChapterVersionInDatabase(this.db, input);
  }

  private async addChapterVersionInDatabase(db: DatabaseLike, input: AddChapterVersionInput): Promise<ChapterVersionRecord> {
    const currentChapter = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, input.chapterId))
      .get();

    if (!currentChapter) {
      throw new Error(`Chapter not found: ${input.chapterId}`);
    }

    await this.expectBodyArtifact(input.bodyArtifactId, db);
    const status = input.status ?? 'Draft';
    if ((status === 'Rejected' || status === 'Superseded') && input.makeCurrent) {
      throw new Error(`${status} versions cannot become current`);
    }
    if (status === 'Accepted' && input.makeCurrent === false) {
      throw new Error('Accepted versions must become current');
    }
    const makeCurrent = input.makeCurrent ?? status === 'Accepted';

    if (status === 'Accepted' && makeCurrent) {
      await db
        .update(chapterVersions)
        .set({ status: 'Superseded' })
        .where(and(eq(chapterVersions.chapterId, input.chapterId), eq(chapterVersions.status, 'Accepted')));
    }

    const existingVersions = await db
      .select()
      .from(chapterVersions)
      .where(eq(chapterVersions.chapterId, input.chapterId))
      .orderBy(asc(chapterVersions.versionNumber))
      .all();
    const now = new Date().toISOString();
    const version: ChapterVersionRecord = {
      id: createRepositoryId('manuscript_version'),
      chapterId: input.chapterId,
      bodyArtifactId: input.bodyArtifactId,
      versionNumber: existingVersions.length + 1,
      status,
      metadata: input.metadata ?? {},
      createdAt: now
    };

    await db.insert(chapterVersions).values({
      id: version.id,
      chapterId: version.chapterId,
      bodyArtifactId: version.bodyArtifactId,
      versionNumber: version.versionNumber,
      status: version.status,
      metadataJson: JSON.stringify(version.metadata),
      createdAt: version.createdAt
    });

    if (makeCurrent) {
      await db
        .update(chapters)
        .set({ currentVersionId: version.id, updatedAt: now })
        .where(eq(chapters.id, input.chapterId));
    }

    return version;
  }

  private async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const client = (this.db as unknown as { session: { client: { execute: (sql: string) => Promise<unknown> } } }).session.client;

    await client.execute('BEGIN IMMEDIATE');
    try {
      const result = await operation();
      await client.execute('COMMIT');
      return result;
    } catch (error) {
      await client.execute('ROLLBACK');
      throw error;
    }
  }

  async listChapters(manuscriptId: string): Promise<ChapterWithVersions[]> {
    const chapterRows = await this.db
      .select()
      .from(chapters)
      .where(eq(chapters.manuscriptId, manuscriptId))
      .orderBy(asc(chapters.order))
      .all();

    const result: ChapterWithVersions[] = [];
    for (const chapter of chapterRows) {
      const versionRows = await this.db
        .select()
        .from(chapterVersions)
        .where(eq(chapterVersions.chapterId, chapter.id))
        .orderBy(asc(chapterVersions.versionNumber))
        .all();

      result.push({
        id: chapter.id,
        manuscriptId: chapter.manuscriptId,
        projectId: chapter.projectId,
        title: chapter.title,
        order: chapter.order,
        status: chapter.status,
        currentVersionId: chapter.currentVersionId,
        metadata: JSON.parse(chapter.metadataJson) as Record<string, unknown>,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
        versions: versionRows.map((version) => ({
          id: version.id,
          chapterId: version.chapterId,
          bodyArtifactId: version.bodyArtifactId,
          versionNumber: version.versionNumber,
          status: version.status as ChapterVersionStatus,
          metadata: JSON.parse(version.metadataJson) as Record<string, unknown>,
          createdAt: version.createdAt
        }))
      });
    }

    return result;
  }

  private async expectBodyArtifact(bodyArtifactId: string, db: DatabaseLike = this.db): Promise<void> {
    const artifact = await db
      .select({ id: artifacts.id })
      .from(artifacts)
      .where(eq(artifacts.id, bodyArtifactId))
      .get();

    if (!artifact) {
      throw new Error(`Body artifact not found: ${bodyArtifactId}`);
    }
  }
}

export function createManuscriptRepository(db: AppDatabase): ManuscriptRepository {
  return new ManuscriptRepository(db);
}

function createRepositoryId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}
