import { describe, expect, it } from 'vitest';
import { adoptBranchScenario, createBranchScenario, projectBranchScenario } from './branches';

describe('Branch scenarios', () => {
  it('keeps branch artifacts outside canon until the scenario is adopted', () => {
    const canon = {
      canonFactIds: ['canon_fact_existing'],
      artifactIds: ['artifact_existing']
    };
    const scenario = createBranchScenario({
      projectId: 'project_abc',
      title: 'Eclipse betrayal route',
      baseCanonFactIds: canon.canonFactIds,
      artifacts: [
        {
          id: 'artifact_branch_scene',
          kind: 'scene_outline',
          content: 'The ally betrays the protagonist during the eclipse.'
        }
      ]
    });

    const projection = projectBranchScenario(canon, scenario);

    expect(projection.canon).toEqual(canon);
    expect(projection.projectedArtifacts).toEqual(scenario.artifacts);
    expect(projection.canonChanged).toBe(false);

    const adopted = adoptBranchScenario(canon, scenario);

    expect(adopted.artifactIds).toEqual(['artifact_existing', 'artifact_branch_scene']);
    expect(adopted.canonFactIds).toEqual(['canon_fact_existing']);
  });
});
