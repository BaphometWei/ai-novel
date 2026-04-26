export type ImportSourceType =
  | 'txt'
  | 'markdown'
  | 'docx-metadata'
  | 'pasted-chapter'
  | 'character-sheet'
  | 'user-note'
  | 'sample-entry';

export interface ImportItemInput {
  sourceType: ImportSourceType;
  name: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface RawImportArtifact {
  id: string;
  kind: 'raw-import';
  sourceType: ImportSourceType;
  name: string;
  content?: string;
  metadata?: Record<string, unknown>;
  hash: string;
  importedAt: string;
}

export interface ImportedChapter {
  id: string;
  title: string;
  body: string;
  sourceArtifactId: string;
}

export interface ImportCandidate {
  id: string;
  type: 'character' | 'note' | 'sample';
  status: 'candidate';
  text: string;
  sourceArtifactId: string;
}

export interface ImportBatchItem {
  id: string;
  sourceType: ImportSourceType;
  name: string;
  rawArtifact: RawImportArtifact;
  extracted: {
    chapter?: ImportedChapter;
    candidates: ImportCandidate[];
  };
}

export interface ImportBatch {
  id: string;
  projectId: string;
  createdAt: string;
  items: ImportBatchItem[];
}

export interface ProjectBundleInput {
  project: Record<string, unknown>;
  chapters?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  canon?: Array<Record<string, unknown>>;
  knowledgeItems?: Array<Record<string, unknown>>;
  sourcePolicies?: Array<Record<string, unknown>>;
  runLogs?: Array<Record<string, unknown>>;
  settingsSnapshot?: Record<string, unknown>;
  createdAt?: string;
}

export type ProjectBundle = Required<Omit<ProjectBundleInput, 'createdAt'>> & {
  format: 'ai-novel-project-bundle';
  version: 1;
  createdAt: string;
  hash: string;
};

export function createImportBatch(input: {
  projectId: string;
  items: ImportItemInput[];
  createdAt?: string;
}): ImportBatch {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const batchSeed = stableStringify({ projectId: input.projectId, createdAt, items: input.items });
  const batchId = `import_batch_${hashHex64(batchSeed).slice(0, 12)}`;

  return {
    id: batchId,
    projectId: input.projectId,
    createdAt,
    items: input.items.map((item, index) => {
      const artifactHash = hashHex64(stableStringify(item));
      const rawArtifact: RawImportArtifact = {
        id: `raw_artifact_${hashHex64(stableStringify({ artifactHash, index })).slice(0, 12)}`,
        kind: 'raw-import',
        sourceType: item.sourceType,
        name: item.name,
        importedAt: createdAt,
        hash: artifactHash,
        ...(item.content === undefined ? {} : { content: item.content }),
        ...(item.metadata === undefined ? {} : { metadata: deepClone(item.metadata) })
      };

      return {
        id: `${batchId}_item_${index + 1}`,
        sourceType: item.sourceType,
        name: item.name,
        rawArtifact,
        extracted: extractImportItem(item, rawArtifact.id)
      };
    })
  };
}

export function createProjectBundle(input: ProjectBundleInput): ProjectBundle {
  const bundleWithoutHash = {
    format: 'ai-novel-project-bundle' as const,
    version: 1 as const,
    project: deepClone(input.project),
    chapters: deepClone(input.chapters ?? []),
    artifacts: deepClone(input.artifacts ?? []),
    canon: deepClone(input.canon ?? []),
    knowledgeItems: deepClone(input.knowledgeItems ?? []),
    sourcePolicies: deepClone(input.sourcePolicies ?? []),
    runLogs: deepClone(input.runLogs ?? []),
    settingsSnapshot: deepClone(input.settingsSnapshot ?? {}),
    createdAt: input.createdAt ?? new Date().toISOString()
  };

  return {
    ...bundleWithoutHash,
    hash: hashProjectBundle(bundleWithoutHash)
  };
}

export function hashProjectBundle(bundle: Omit<ProjectBundle, 'hash'> | ProjectBundle): string {
  const { hash: _hash, ...hashable } = bundle as ProjectBundle;
  return hashHex64(stableStringify(hashable));
}

function extractImportItem(
  item: ImportItemInput,
  sourceArtifactId: string
): { chapter?: ImportedChapter; candidates: ImportCandidate[] } {
  if (item.sourceType === 'txt' || item.sourceType === 'markdown' || item.sourceType === 'pasted-chapter') {
    return {
      chapter: parseChapter(item, sourceArtifactId),
      candidates: []
    };
  }

  if (item.sourceType === 'character-sheet') {
    return { candidates: [candidate('character', item, sourceArtifactId)] };
  }

  if (item.sourceType === 'user-note') {
    return { candidates: [candidate('note', item, sourceArtifactId)] };
  }

  if (item.sourceType === 'sample-entry') {
    return { candidates: [candidate('sample', item, sourceArtifactId)] };
  }

  return { candidates: [] };
}

function parseChapter(item: ImportItemInput, sourceArtifactId: string): ImportedChapter {
  const content = item.content ?? '';
  if (item.sourceType === 'markdown') {
    const lines = content.split(/\r?\n/);
    const headingIndex = lines.findIndex((line) => line.startsWith('# '));
    if (headingIndex >= 0) {
      const title = lines[headingIndex]?.replace(/^#\s+/, '').trim() ?? titleFromName(item.name);
      const body = lines.filter((_, index) => index !== headingIndex).join('\n').trim();
      return chapter(title || titleFromName(item.name), body, sourceArtifactId);
    }
  }

  if (item.sourceType === 'txt') {
    const [, ...remaining] = content.split(/\r?\n/);
    const body = remaining.length > 0 ? remaining.join('\n').trim() : content.trim();
    return chapter(titleFromName(item.name) || 'Untitled chapter', body, sourceArtifactId);
  }

  return chapter(item.name || 'Pasted chapter', content.trim(), sourceArtifactId);
}

function chapter(title: string, body: string, sourceArtifactId: string): ImportedChapter {
  const id = `chapter_${hashHex64(stableStringify({ title, body, sourceArtifactId })).slice(0, 12)}`;
  return { id, title, body, sourceArtifactId };
}

function candidate(type: ImportCandidate['type'], item: ImportItemInput, sourceArtifactId: string): ImportCandidate {
  const text = item.content ?? stableStringify(item.metadata ?? {});
  return {
    id: `${type}_${hashHex64(stableStringify({ type, text, sourceArtifactId })).slice(0, 12)}`,
    type,
    status: 'candidate',
    text,
    sourceArtifactId
  };
}

function titleFromName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim();
}

function hashHex64(value: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  return seeds
    .map((seed) => {
      let hash = seed >>> 0;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, '0');
    })
    .join('')
    .repeat(2)
    .slice(0, 64);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortObject(child)])
    );
  }

  return value;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
