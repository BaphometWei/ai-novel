export interface BranchCanonSnapshot {
  canonFactIds: string[];
  artifactIds: string[];
}

export interface BranchArtifact {
  id: string;
  kind: string;
  content: string;
}

export interface BranchScenario {
  id: string;
  projectId: string;
  title: string;
  baseCanonFactIds: string[];
  artifacts: BranchArtifact[];
}

export function createBranchScenario(input: Omit<BranchScenario, 'id'>): BranchScenario {
  return {
    id: `branch_scenario_${crypto.randomUUID().replace(/-/g, '')}`,
    ...input,
    baseCanonFactIds: [...input.baseCanonFactIds],
    artifacts: input.artifacts.map((artifact) => ({ ...artifact }))
  };
}

export function projectBranchScenario(canon: BranchCanonSnapshot, scenario: BranchScenario) {
  return {
    canon: cloneCanonSnapshot(canon),
    projectedArtifacts: scenario.artifacts.map((artifact) => ({ ...artifact })),
    canonChanged: false
  };
}

export function adoptBranchScenario(canon: BranchCanonSnapshot, scenario: BranchScenario): BranchCanonSnapshot {
  return {
    canonFactIds: [...canon.canonFactIds],
    artifactIds: [...canon.artifactIds, ...scenario.artifacts.map((artifact) => artifact.id)]
  };
}

function cloneCanonSnapshot(canon: BranchCanonSnapshot): BranchCanonSnapshot {
  return {
    canonFactIds: [...canon.canonFactIds],
    artifactIds: [...canon.artifactIds]
  };
}
