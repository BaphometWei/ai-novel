import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';

describe('persistent workbench API routes', () => {
  it('persists review reports, knowledge items, and reader feedback for API-created projects', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Long Night',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });
    const project = projectResponse.json();

    const reviewResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/review/reports`,
      payload: {
        manuscriptVersionId: 'artifact_version_1',
        profile: { id: 'profile_standard', name: 'Standard', enabledCategories: ['continuity'] },
        findings: [
          {
            manuscriptVersionId: 'artifact_version_1',
            category: 'continuity',
            severity: 'High',
            problem: 'Secret used before reveal.',
            evidenceCitations: [{ sourceId: 'secret_1', quote: 'Reveal happens later.' }],
            impact: 'Breaks knowledge boundary.',
            fixOptions: ['Move the line after reveal'],
            autoFixRisk: 'Medium'
          }
        ],
        qualityScore: { overall: 76, continuity: 60, promiseSatisfaction: 80, prose: 84 }
      }
    });
    const reviewReport = reviewResponse.json();

    const knowledgeResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/knowledge/items`,
      payload: {
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
      }
    });

    await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/serialization/reader-feedback`,
      payload: {
        longTermPlanId: 'plan_main',
        feedback: [
          { id: 'feedback_1', chapterId: 'chapter_1', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' }
        ]
      }
    });

    const reloadedReview = await runtime.app.inject({ method: 'GET', url: `/projects/${project.id}/review/reports/${reviewReport.id}` });
    const listedReviews = await runtime.app.inject({ method: 'GET', url: `/projects/${project.id}/review/reports` });
    const sourceContext = await runtime.app.inject({ method: 'GET', url: `/projects/${project.id}/knowledge/generation-context` });
    const feedbackSummary = await runtime.app.inject({
      method: 'GET',
      url: `/projects/${project.id}/serialization/feedback-summary?longTermPlanId=plan_main`
    });

    expect(projectResponse.statusCode).toBe(201);
    expect(reviewResponse.statusCode).toBe(201);
    expect(knowledgeResponse.statusCode).toBe(201);
    expect(reloadedReview.json()).toMatchObject({
      id: reviewReport.id,
      projectId: project.id,
      openFindingCount: 1,
      findings: [{ problem: 'Secret used before reveal.' }]
    });
    expect(listedReviews.statusCode).toBe(200);
    expect(listedReviews.json()).toMatchObject([
      {
        id: reviewReport.id,
        projectId: project.id,
        findings: [{ problem: 'Secret used before reveal.' }]
      }
    ]);
    expect(sourceContext.json().included).toEqual([knowledgeResponse.json()]);
    expect(feedbackSummary.json()).toMatchObject({
      longTermPlanId: 'plan_main',
      sentimentCounts: { Positive: 0, Neutral: 0, Negative: 1 },
      feedbackCount: 1
    });
    runtime.database.client.close();
  });

  it('does not expose review reports through another project scope', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const firstProjectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: { title: 'First', language: 'zh-CN', targetAudience: 'Chinese web-novel readers' }
    });
    const secondProjectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: { title: 'Second', language: 'zh-CN', targetAudience: 'Chinese web-novel readers' }
    });
    const firstProject = firstProjectResponse.json();
    const secondProject = secondProjectResponse.json();
    const reviewResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${firstProject.id}/review/reports`,
      payload: {
        manuscriptVersionId: 'artifact_version_1',
        profile: { id: 'profile_standard', name: 'Standard', enabledCategories: ['continuity'] },
        findings: [],
        qualityScore: { overall: 90, continuity: 90, promiseSatisfaction: 90, prose: 90 }
      }
    });
    const reviewReport = reviewResponse.json();

    const crossProjectResponse = await runtime.app.inject({
      method: 'GET',
      url: `/projects/${secondProject.id}/review/reports/${reviewReport.id}`
    });

    expect(crossProjectResponse.statusCode).toBe(404);
    expect(crossProjectResponse.json()).toEqual({ error: 'Review report not found' });
    runtime.database.client.close();
  });

  it('persists revision suggestions inside the owning project review scope', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: { title: 'Long Night', language: 'zh-CN', targetAudience: 'Chinese web-novel readers' }
    });
    const project = projectResponse.json();
    const reviewResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/review/reports`,
      payload: {
        manuscriptVersionId: 'artifact_version_1',
        profile: { id: 'profile_standard', name: 'Standard', enabledCategories: ['continuity'] },
        findings: [
          {
            manuscriptVersionId: 'artifact_version_1',
            category: 'continuity',
            severity: 'High',
            problem: 'Secret used before reveal.',
            evidenceCitations: [{ sourceId: 'secret_1', quote: 'Reveal happens later.' }],
            impact: 'Breaks knowledge boundary.',
            fixOptions: ['Move the line after reveal'],
            autoFixRisk: 'Medium'
          }
        ],
        qualityScore: { overall: 76, continuity: 60, promiseSatisfaction: 80, prose: 84 }
      }
    });
    const finding = reviewResponse.json().findings[0];

    const createSuggestionResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/review/revision-suggestions`,
      payload: {
        findingId: finding.id,
        manuscriptVersionId: finding.manuscriptVersionId,
        title: 'Move secret use after reveal',
        rationale: 'Keeps the knowledge boundary intact.',
        diff: {
          before: 'Mira names the living bell before the reveal.',
          after: 'Mira hears the living bell but cannot name it yet.'
        },
        risk: 'Medium'
      }
    });
    const suggestion = createSuggestionResponse.json();

    const reloadSuggestionResponse = await runtime.app.inject({
      method: 'GET',
      url: `/projects/${project.id}/review/revision-suggestions/${suggestion.id}`
    });

    expect(createSuggestionResponse.statusCode).toBe(201);
    expect(suggestion).toMatchObject({
      findingId: finding.id,
      status: 'Proposed',
      diff: { after: 'Mira hears the living bell but cannot name it yet.' }
    });
    expect(reloadSuggestionResponse.statusCode).toBe(200);
    expect(reloadSuggestionResponse.json()).toMatchObject({ id: suggestion.id, findingId: finding.id });
    runtime.database.client.close();
  });

  it('does not expose revision suggestions through another project scope', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const firstProjectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: { title: 'First', language: 'zh-CN', targetAudience: 'Chinese web-novel readers' }
    });
    const secondProjectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: { title: 'Second', language: 'zh-CN', targetAudience: 'Chinese web-novel readers' }
    });
    const firstProject = firstProjectResponse.json();
    const secondProject = secondProjectResponse.json();
    const reviewResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${firstProject.id}/review/reports`,
      payload: {
        manuscriptVersionId: 'artifact_version_1',
        profile: { id: 'profile_standard', name: 'Standard', enabledCategories: ['continuity'] },
        findings: [
          {
            manuscriptVersionId: 'artifact_version_1',
            category: 'continuity',
            severity: 'High',
            problem: 'Secret used before reveal.',
            evidenceCitations: [{ sourceId: 'secret_1', quote: 'Reveal happens later.' }],
            impact: 'Breaks knowledge boundary.',
            fixOptions: ['Move the line after reveal'],
            autoFixRisk: 'Medium'
          }
        ],
        qualityScore: { overall: 76, continuity: 60, promiseSatisfaction: 80, prose: 84 }
      }
    });
    const finding = reviewResponse.json().findings[0];
    const createSuggestionResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${firstProject.id}/review/revision-suggestions`,
      payload: {
        findingId: finding.id,
        manuscriptVersionId: finding.manuscriptVersionId,
        title: 'Move secret use after reveal',
        rationale: 'Keeps the knowledge boundary intact.',
        diff: { before: 'before', after: 'after' },
        risk: 'Medium'
      }
    });
    const suggestion = createSuggestionResponse.json();

    const crossProjectCreate = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${secondProject.id}/review/revision-suggestions`,
      payload: {
        findingId: finding.id,
        manuscriptVersionId: finding.manuscriptVersionId,
        title: 'Cross scope suggestion',
        rationale: 'Should not attach to another project.',
        diff: { before: 'before', after: 'after' },
        risk: 'Low'
      }
    });
    const crossProjectRead = await runtime.app.inject({
      method: 'GET',
      url: `/projects/${secondProject.id}/review/revision-suggestions/${suggestion.id}`
    });

    expect(crossProjectCreate.statusCode).toBe(404);
    expect(crossProjectCreate.json()).toEqual({ error: 'Review finding not found' });
    expect(crossProjectRead.statusCode).toBe(404);
    expect(crossProjectRead.json()).toEqual({ error: 'Revision suggestion not found' });
    runtime.database.client.close();
  });

  it('imports duplicate reader feedback ids idempotently without partial failure', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: { title: 'Long Night', language: 'zh-CN', targetAudience: 'Chinese web-novel readers' }
    });
    const project = projectResponse.json();

    const firstImport = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/serialization/reader-feedback`,
      payload: {
        longTermPlanId: 'plan_main',
        feedback: [
          { id: 'feedback_1', chapterId: 'chapter_1', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' },
          { id: 'feedback_1', chapterId: 'chapter_1', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' }
        ]
      }
    });
    const retryImport = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/serialization/reader-feedback`,
      payload: {
        longTermPlanId: 'plan_main',
        feedback: [
          { id: 'feedback_1', chapterId: 'chapter_1', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' }
        ]
      }
    });

    expect(firstImport.statusCode).toBe(200);
    expect(firstImport.json()).toMatchObject({ feedbackCount: 1 });
    expect(retryImport.statusCode).toBe(200);
    expect(retryImport.json()).toMatchObject({ feedbackCount: 1 });
    runtime.database.client.close();
  });

  it('keeps default in-memory feedback imports idempotent like the persistent runtime', async () => {
    const app = buildApp();
    const projectResponse = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { title: 'Long Night', language: 'zh-CN', targetAudience: 'Chinese web-novel readers' }
    });
    const project = projectResponse.json();

    await app.inject({
      method: 'POST',
      url: `/projects/${project.id}/serialization/reader-feedback`,
      payload: {
        longTermPlanId: 'plan_main',
        feedback: [
          { id: 'feedback_1', chapterId: 'chapter_1', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' }
        ]
      }
    });
    const retryImport = await app.inject({
      method: 'POST',
      url: `/projects/${project.id}/serialization/reader-feedback`,
      payload: {
        longTermPlanId: 'plan_main',
        feedback: [
          { id: 'feedback_1', chapterId: 'chapter_1', segment: 'core_reader', sentiment: 'Negative', tags: ['pacing'], text: 'Too slow' }
        ]
      }
    });

    expect(retryImport.statusCode).toBe(200);
    expect(retryImport.json()).toMatchObject({ feedbackCount: 1 });
  });
});
