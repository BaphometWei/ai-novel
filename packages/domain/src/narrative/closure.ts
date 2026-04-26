export function createClosureChecklist(input: {
  projectId: string;
  promises: Array<{ id: string; importance: string; status: string; summary: string }>;
  characterArcs: Array<{ id: string; characterId: string; importance: string; status: string; summary: string }>;
}) {
  const promiseItems = input.promises
    .filter((promise) => promise.importance === 'Core' && promise.status !== 'Closed' && promise.status !== 'Resolved')
    .map((promise) => ({
      sourceType: 'ReaderPromise',
      sourceId: promise.id,
      severity: 'Blocking',
      label: `Resolve Core promise: ${promise.summary}`
    }));

  const arcItems = input.characterArcs
    .filter((arc) => arc.importance === 'Major' && arc.status !== 'Closed' && arc.status !== 'Resolved')
    .map((arc) => ({
      sourceType: 'CharacterArc',
      sourceId: arc.id,
      severity: 'Blocking',
      label: `Close major character arc: ${arc.summary}`
    }));

  return {
    projectId: input.projectId,
    items: [...promiseItems, ...arcItems]
  };
}
