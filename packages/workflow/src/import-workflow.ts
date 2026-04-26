import { createImportBatch, type ImportBatch, type ImportItemInput } from '@ai-novel/domain';

export interface LocalProject {
  project: Record<string, unknown>;
  chapters: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
  canon: Array<Record<string, unknown>>;
  knowledgeItems: Array<Record<string, unknown>>;
  sourcePolicies: Array<Record<string, unknown>>;
  runLogs: Array<Record<string, unknown>>;
  settingsSnapshot: Record<string, unknown>;
}

export function importIntoProject(
  project: LocalProject,
  input: { items: ImportItemInput[]; createdAt?: string }
): { project: LocalProject; batch: ImportBatch } {
  const batch = createImportBatch({
    projectId: String(project.project.id),
    createdAt: input.createdAt,
    items: input.items
  });
  const chapters = batch.items.flatMap((item) => (item.extracted.chapter ? [item.extracted.chapter] : []));
  const candidates = batch.items.flatMap((item) => item.extracted.candidates);

  return {
    batch,
    project: {
      ...project,
      chapters: [...project.chapters, ...chapters.map(toRecord)],
      artifacts: [...project.artifacts, ...batch.items.map((item) => toRecord(item.rawArtifact))],
      knowledgeItems: [...project.knowledgeItems, ...candidates.map(toRecord)]
    }
  };
}

function toRecord(value: object): Record<string, unknown> {
  return { ...value };
}
