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
      uri: 'artifacts/context-pack.json',
      relatedRunId: 'agent_run_context'
    });

    await repository.save(artifact);

    await expect(repository.findByHash('sha256:abc')).resolves.toMatchObject({
      id: artifact.id,
      type: 'context_pack',
      version: 1,
      relatedRunId: 'agent_run_context'
    });
    database.client.close();
  });

  it('finds artifact metadata by id', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new ArtifactRepository(database.db);
    const artifact = createArtifactRecord({
      type: 'agent_output',
      source: 'agent_run',
      version: 2,
      hash: 'sha256:def',
      uri: 'artifacts/agent-output.json'
    });

    await repository.save(artifact);

    await expect(repository.findById(artifact.id)).resolves.toEqual(artifact);
    await expect(repository.findById('artifact_missing')).resolves.toBeNull();
    database.client.close();
  });

  it('lists artifact metadata with optional type, source, and limit filters', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new ArtifactRepository(database.db);
    const contextPack = {
      ...createArtifactRecord({
        type: 'context_pack',
        source: 'agent_run',
        version: 1,
        hash: 'sha256:context',
        uri: 'artifacts/context-pack.json'
      }),
      createdAt: '2026-04-27T06:00:00.000Z'
    };
    const agentOutput = {
      ...createArtifactRecord({
        type: 'agent_output',
        source: 'agent_run',
        version: 1,
        hash: 'sha256:agent',
        uri: 'artifacts/agent-output.json'
      }),
      createdAt: '2026-04-27T06:01:00.000Z'
    };
    const importRaw = {
      ...createArtifactRecord({
        type: 'import_raw',
        source: 'import',
        version: 1,
        hash: 'sha256:import',
        uri: 'artifacts/import-raw.json'
      }),
      createdAt: '2026-04-27T06:02:00.000Z'
    };

    await repository.save(contextPack);
    await repository.save(agentOutput);
    await repository.save(importRaw);

    await expect(repository.list({ type: 'agent_output' })).resolves.toEqual([agentOutput]);
    await expect(repository.list({ source: 'agent_run', limit: 1 })).resolves.toEqual([contextPack]);
    await expect(repository.list({ type: 'context_pack', source: 'agent_run' })).resolves.toEqual([
      contextPack
    ]);
    database.client.close();
  });
});
