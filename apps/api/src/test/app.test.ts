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
