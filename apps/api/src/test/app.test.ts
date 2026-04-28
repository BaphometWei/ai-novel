import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('API app', () => {
  it('reports health', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: 'ai-novel-api' });
  });

  it('creates and returns a project through the API', async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Long Night',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toMatchObject({ title: 'Long Night', status: 'Active' });

    const getResponse = await app.inject({ method: 'GET', url: `/projects/${created.id}` });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({ id: created.id, title: 'Long Night' });
  });

  it('lists projects through the API', async () => {
    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Long Night',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });

    const response = await app.inject({ method: 'GET', url: '/projects' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({ title: 'Long Night', status: 'Active' })
    ]);
  });

  it('registers settings routes in the app shell', async () => {
    const app = buildApp();
    const save = await app.inject({
      method: 'PUT',
      url: '/settings/providers/openai',
      payload: { model: 'gpt-test', apiKey: 'sk-local-secret', maxRunCostUsd: 0.25 }
    });
    const read = await app.inject({ method: 'GET', url: '/settings/providers/openai' });

    expect(save.statusCode).toBe(200);
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      budget: { maxRunCostUsd: 0.25 }
    });
    expect(JSON.stringify(read.json())).not.toContain('sk-local-secret');
  });

  it('registers workflow surface routes in the app shell', async () => {
    const app = buildApp({ harnessMode: 'demo' });

    const agentRoom = await app.inject({ method: 'GET', url: '/agent-room/runs' });
    const memory = await app.inject({
      method: 'POST',
      url: '/projects/project_app/memory/extractions',
      payload: {
        source: {
          kind: 'AcceptedManuscriptText',
          manuscriptVersionId: 'manuscript_version_app',
          text: 'Accepted text.'
        }
      }
    });
    const backup = await app.inject({
      method: 'POST',
      url: '/projects/project_app/backups',
      payload: { reason: 'manual' }
    });

    expect(agentRoom.statusCode).toBe(200);
    expect(agentRoom.json()).toEqual([]);
    expect(memory.statusCode).toBe(201);
    expect(memory.json()).toEqual({ candidates: [], approvalRequests: [] });
    expect(backup.statusCode).toBe(201);
    expect(backup.json()).toMatchObject({
      job: { type: 'backup.create', status: 'Succeeded', projectId: 'project_app' },
      status: { ok: true, stage: 'created' }
    });
  });

  it('does not silently use demo writing or backup dependencies by default', async () => {
    const app = buildApp();

    const writing = await app.inject({
      method: 'POST',
      url: '/projects/project_app/writing-runs',
      payload: {
        target: {
          manuscriptId: 'manuscript_app',
          chapterId: 'chapter_app',
          range: 'chapter_1'
        },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft without configured runtime',
          mustWrite: 'This should not use a silent fake provider.',
          wordRange: { min: 100, max: 200 },
          forbiddenChanges: ['Do not hide missing dependencies'],
          acceptanceCriteria: ['Returns a clear error']
        },
        retrieval: { query: 'missing runtime' }
      }
    });
    const backup = await app.inject({
      method: 'POST',
      url: '/projects/project_app/backups',
      payload: { reason: 'manual' }
    });

    expect(writing.statusCode).toBe(503);
    expect(writing.json()).toEqual({ error: 'Writing run dependencies are not configured' });
    expect(backup.statusCode).toBe(503);
    expect(backup.json()).toEqual({ error: 'Backup dependencies are not configured' });
  });

  it('preserves deterministic writing and backup behavior in explicit demo harness mode', async () => {
    const app = buildApp({ harnessMode: 'demo' });

    const writing = await app.inject({
      method: 'POST',
      url: '/projects/project_app/writing-runs',
      payload: {
        target: {
          manuscriptId: 'manuscript_app',
          chapterId: 'chapter_app',
          range: 'chapter_1'
        },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft in demo mode',
          mustWrite: 'Use the explicit demo fake provider.',
          wordRange: { min: 100, max: 200 },
          forbiddenChanges: ['Do not call external providers'],
          acceptanceCriteria: ['Returns a deterministic draft']
        },
        retrieval: { query: 'demo runtime' }
      }
    });
    const backup = await app.inject({
      method: 'POST',
      url: '/projects/project_app/backups',
      payload: { reason: 'manual' }
    });

    expect(writing.statusCode).toBe(201);
    expect(writing.json()).toMatchObject({
      status: 'AwaitingAcceptance',
      draftArtifact: { text: 'Deterministic writing draft' }
    });
    expect(backup.statusCode).toBe(201);
    expect(backup.json()).toMatchObject({
      job: { type: 'backup.create', status: 'Succeeded', projectId: 'project_app' },
      status: { ok: true, stage: 'created' }
    });
  });

  it('returns 400 for invalid project payloads', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: '',
        language: 'zh-CN',
        targetAudience: ''
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'Invalid project payload' });
  });

  it('creates review findings and revision suggestions through the API', async () => {
    const app = buildApp();
    const findingResponse = await app.inject({
      method: 'POST',
      url: '/review/findings',
      payload: {
        manuscriptVersionId: 'artifact_version_1',
        category: 'continuity',
        severity: 'High',
        problem: 'Secret used before reveal.',
        evidenceCitations: [{ sourceId: 'secret_1', quote: 'Reveal happens later.' }],
        impact: 'Breaks knowledge boundary.',
        fixOptions: ['Move the line after reveal'],
        autoFixRisk: 'Medium'
      }
    });

    expect(findingResponse.statusCode).toBe(201);
    const finding = findingResponse.json();
    expect(finding).toMatchObject({ status: 'Open', problem: 'Secret used before reveal.' });

    const suggestionResponse = await app.inject({
      method: 'POST',
      url: '/review/revision-suggestions',
      payload: {
        findingId: finding.id,
        manuscriptVersionId: finding.manuscriptVersionId,
        title: 'Move secret use',
        rationale: 'Preserve reveal order.',
        diff: { before: 'She names him.', after: 'She suspects him.' },
        risk: 'Medium'
      }
    });

    expect(suggestionResponse.statusCode).toBe(201);
    expect(suggestionResponse.json()).toMatchObject({ status: 'Proposed', title: 'Move secret use' });
  });

  it('summarizes reader feedback imports through the API', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/serialization/feedback-summary',
      payload: {
        longTermPlanId: 'plan_main',
        feedback: [
          { id: 'feedback_1', chapterId: 'chapter_1', segment: 'new_reader', sentiment: 'Positive', tags: ['hook'], text: 'Strong hook' },
          { id: 'feedback_2', chapterId: 'chapter_2', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      longTermPlanId: 'plan_main',
      sentimentCounts: { Positive: 1, Neutral: 0, Negative: 1 },
      overridesLongTermPlan: false
    });
  });

  it('builds knowledge generation source context through the API', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/knowledge/generation-context',
      payload: {
        items: [
          {
            id: 'knowledge_owned',
            title: 'Owned setting note',
            kind: 'WorldTemplate',
            lifecycleStatus: 'Active',
            material: {
              sourceTitle: 'Author note',
              sourcePolicy: {
                sourceType: 'user_note',
                allowedUse: ['generation_support'],
                prohibitedUse: [],
                attributionRequirements: 'none',
                licenseNotes: 'owned',
                similarityRisk: 'Low'
              },
              extractedSummary: 'A floating archive city.'
            },
            tags: ['world']
          },
          {
            id: 'knowledge_restricted',
            title: 'Sample fight cadence',
            kind: 'Sample',
            lifecycleStatus: 'Active',
            material: {
              sourceTitle: 'Web excerpt',
              sourcePolicy: {
                sourceType: 'web_excerpt',
                allowedUse: ['analysis'],
                prohibitedUse: ['generation_support'],
                attributionRequirements: 'cite source',
                licenseNotes: 'unknown',
                similarityRisk: 'High'
              },
              extractedSummary: 'Punchy cadence sample.'
            },
            tags: ['style']
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const context = response.json();
    expect(context.included.map((item: { id: string }) => item.id)).toEqual(['knowledge_owned']);
    expect(context.exclusions[0]).toMatchObject({
      knowledgeItemId: 'knowledge_restricted',
      reason: 'Source policy prohibits generation support'
    });
  });
});
