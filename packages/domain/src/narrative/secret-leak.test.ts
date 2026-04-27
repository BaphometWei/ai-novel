import { describe, expect, it } from 'vitest';
import { createKnowledgeState, createSecret } from './secrets';
import { detectSecretLeaks } from './secret-leak';

describe('Secret leak detection', () => {
  it('reports hidden secret text exposed to the reader before its planned reveal', () => {
    const secret = createSecret({
      id: 'secret_heir_identity',
      projectId: 'project_abc',
      title: 'Mei is the lost heir',
      hiddenTruth: 'Mei is the lost heir to the western court',
      status: 'Hidden'
    });

    const leaks = detectSecretLeaks({
      currentChapter: 3,
      secrets: [secret],
      knowledgeStates: [createKnowledgeState({ secretId: secret.id })],
      plannedReveals: [{ secretId: secret.id, chapter: 8, audience: 'Reader' }],
      exposures: [
        {
          id: 'scene_3',
          source: 'Manuscript',
          audience: 'Reader',
          text: 'The old seal proved Mei is the lost heir to the western court.'
        }
      ]
    });

    expect(leaks).toEqual([
      {
        secretId: secret.id,
        source: 'Manuscript',
        exposureId: 'scene_3',
        audience: 'Reader',
        plannedRevealChapter: 8,
        severity: 'High',
        evidence: 'The old seal proved Mei is the lost heir to the western court.'
      }
    ]);
  });

  it('reports agent output leaking a hidden secret to a character that does not know it', () => {
    const secret = createSecret({
      id: 'secret_traitor',
      projectId: 'project_abc',
      title: 'The quartermaster is the traitor',
      hiddenTruth: 'The quartermaster sold the route map',
      status: 'Hidden'
    });

    const leaks = detectSecretLeaks({
      currentChapter: 6,
      secrets: [secret],
      knowledgeStates: [createKnowledgeState({ secretId: secret.id })],
      plannedReveals: [{ secretId: secret.id, chapter: 9, audience: 'Character', characterId: 'scout' }],
      exposures: [
        {
          id: 'agent_run_12',
          source: 'AgentOutput',
          audience: 'Character',
          characterId: 'scout',
          text: 'Have the scout accuse the quartermaster because the quartermaster sold the route map.'
        }
      ]
    });

    expect(leaks).toHaveLength(1);
    expect(leaks[0]).toMatchObject({
      secretId: secret.id,
      source: 'AgentOutput',
      audience: 'Character',
      characterId: 'scout',
      plannedRevealChapter: 9,
      severity: 'High'
    });
  });
});
