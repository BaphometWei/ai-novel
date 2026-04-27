import { createArtifactRecord } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ArtifactRepository } from '../repositories/artifact.repository';

describe('ArtifactRepository', () => {
  it('stores versioned artifact metadata by hash', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new ArtifactRepository(database.db);
    const artifact = createArtifactRecord({
      type: 'context_pack',
      source: 'agent_run',
      version: 1,
      hash: 'sha256:abc',
      uri: 'artifacts/context-pack.json'
    });

    await repository.save(artifact);

    await expect(repository.findByHash('sha256:abc')).resolves.toMatchObject({
      id: artifact.id,
      type: 'context_pack',
      version: 1
    });
    database.client.close();
  });
});
