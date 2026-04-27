import { expect, test, type Route } from '@playwright/test';

test('API-backed manuscript writing flow creates a chapter, generates a draft, and accepts it as current', async ({
  page
}) => {
  let createdChapterRequest: unknown;
  let writingRunRequest: unknown;
  let acceptedVersionRequest: unknown;

  await page.route('**/projects', async (route) => {
    await fulfillJson(route, [{ id: 'project_e2e_writing', title: 'E2E Writing Project' }]);
  });
  await page.route('**/projects/project_e2e_writing', async (route) => {
    await fulfillJson(route, { id: 'project_e2e_writing', title: 'E2E Writing Project', status: 'Drafting' });
  });
  await page.route('**/projects/project_e2e_writing/chapters', async (route) => {
    if (route.request().method() === 'POST') {
      createdChapterRequest = await route.request().postDataJSON();
      await fulfillJson(
        route,
        {
          chapter: {
            id: 'chapter_e2e_created',
            title: 'New working chapter',
            manuscriptId: 'manuscript_e2e',
            currentVersionId: 'version_e2e_created',
            versions: [
              {
                id: 'version_e2e_created',
                chapterId: 'chapter_e2e_created',
                versionNumber: 1,
                bodyArtifactId: 'artifact_e2e_created',
                status: 'Draft'
              }
            ]
          },
          version: {
            id: 'version_e2e_created',
            chapterId: 'chapter_e2e_created',
            versionNumber: 1,
            bodyArtifactId: 'artifact_e2e_created',
            status: 'Draft'
          }
        },
        201
      );
      return;
    }

    await fulfillJson(route, [
      {
        id: 'chapter_e2e_opening',
        title: 'Opening Signal',
        manuscriptId: 'manuscript_e2e',
        currentVersionId: 'version_e2e_opening',
        versions: [
          {
            id: 'version_e2e_opening',
            chapterId: 'chapter_e2e_opening',
            versionNumber: 2,
            bodyArtifactId: 'artifact_e2e_opening',
            status: 'Draft'
          }
        ]
      }
    ]);
  });
  await page.route('**/projects/project_e2e_writing/writing-runs', async (route) => {
    expect(route.request().method()).toBe('POST');
    writingRunRequest = await route.request().postDataJSON();
    await fulfillJson(route, {
      id: 'writing_run_e2e',
      status: 'AwaitingAcceptance',
      manuscriptVersionId: null,
      draftArtifact: {
        id: 'draft_artifact_e2e',
        type: 'draft_prose',
        status: 'Draft',
        text: 'Mira followed the bell-sparks through the flooded archive.',
        contextPackId: 'context_pack_e2e_writing'
      },
      selfCheckArtifact: {
        id: 'self_check_e2e',
        type: 'self_check',
        status: 'Completed',
        result: {
          summary: 'Draft satisfies the chapter contract.',
          passed: true,
          findings: ['Keep the bell source unresolved.']
        }
      },
      contextPack: {
        id: 'context_pack_e2e_writing',
        taskGoal: 'Draft New working chapter',
        agentRole: 'Writer',
        riskLevel: 'Medium',
        sections: [{ name: 'canon', content: 'The archive floods only when the bell rings.' }],
        citations: [{ sourceId: 'canon_flooded_archive', quote: 'bell rings and the archive floods' }],
        exclusions: [],
        warnings: ['Canon candidate requires author review.'],
        retrievalTrace: ['query:New working chapter'],
        createdAt: '2026-04-27T12:00:00.000Z'
      }
    });
  });
  await page.route('**/chapters/chapter_e2e_created/versions', async (route) => {
    expect(route.request().method()).toBe('POST');
    acceptedVersionRequest = await route.request().postDataJSON();
    await fulfillJson(
      route,
      {
        id: 'version_e2e_accepted',
        chapterId: 'chapter_e2e_created',
        versionNumber: 2,
        bodyArtifactId: 'artifact_e2e_accepted',
        status: 'Accepted'
      },
      201
    );
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Manuscript Editor' })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'Opening Signal' })).toBeVisible();

  await page.getByRole('button', { name: 'New chapter' }).click();
  await expect(page.getByRole('treeitem', { name: 'New working chapter' })).toHaveAttribute('aria-selected', 'true');
  expect(createdChapterRequest).toMatchObject({
    title: 'New working chapter',
    order: 2,
    body: 'New chapter draft.',
    status: 'Draft'
  });

  await page.getByRole('button', { name: 'Generate draft' }).click();

  const draftEditor = page.getByRole('textbox', { name: 'Scene draft editor' });
  await expect(draftEditor).toContainText('Mira followed the bell-sparks through the flooded archive.');
  await draftEditor.fill('Mira revised the bell-sparks clue before accepting the chapter.');
  await expect(page.getByText('Draft satisfies the chapter contract.')).toBeVisible();
  await expect(page.getByText('The archive floods only when the bell rings.')).toBeVisible();
  await expect(page.getByText('Canon candidate requires author review.')).toBeVisible();
  await expect(page.getByText('Keep the bell source unresolved.')).toBeVisible();
  await expect(page.getByText('bell rings and the archive floods')).toBeVisible();
  expect(writingRunRequest).toMatchObject({
    target: {
      manuscriptId: 'manuscript_e2e',
      chapterId: 'chapter_e2e_created',
      range: 'New working chapter'
    },
    contract: {
      authorshipLevel: 'A3',
      goal: 'Draft New working chapter',
      mustWrite: 'Draft the selected chapter: New working chapter.',
      wordRange: { min: 300, max: 900 },
      forbiddenChanges: ['Do not change canon without review'],
      acceptanceCriteria: ['Ready for author acceptance']
    },
    retrieval: {
      query: 'New working chapter',
      maxContextItems: 4,
      maxSectionChars: 1200
    }
  });

  await page.getByRole('button', { name: 'Accept draft into manuscript' }).click();

  await expect(page.getByText('Accepted as version_e2e_accepted.')).toBeVisible();
  expect(acceptedVersionRequest).toEqual({
    body: 'Mira revised the bell-sparks clue before accepting the chapter.',
    status: 'Accepted',
    makeCurrent: true,
    metadata: {
      acceptedFromRunId: 'writing_run_e2e',
      draftArtifactId: 'draft_artifact_e2e'
    }
  });
});

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}
