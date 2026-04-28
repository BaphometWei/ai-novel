import { expect, test, type Page, type Route } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await routeSelectedProject(page);
});

test('workspace dashboard loads', async ({ page }) => {
  await page.route('**/api/approvals', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [] })
    });
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'AI Novel Workspace' })).toBeVisible();
  await expect(page.getByText('Current Project')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manuscript Editor' })).toBeVisible();
  await expect(page.getByText('Decision Queue')).toBeVisible();
  await expect(page.getByText('Review Center')).toBeVisible();
  await expect(page.getByText('Serialization Desk')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Observability' })).toBeVisible();
});

test('workspace has no horizontal overflow on desktop and mobile', async ({ browser }) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 1200 }
  ]) {
    const page = await browser.newPage({ viewport });
    await routeSelectedProject(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Manuscript Editor' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.close();
  }
});

test('settings panel saves model routing budget and source policy defaults through the API', async ({ page }) => {
  let modelRoutingRequest: unknown;
  let budgetRequest: unknown;
  let sourcePolicyRequest: unknown;

  await page.route('**/api/settings/providers/openai', async (route) => {
    await fulfillJson(route, {
      provider: 'openai',
      defaultModel: 'gpt-5-mini',
      secretRef: 'env:OPENAI_API_KEY',
      redactedMetadata: {},
      updatedAt: '2026-04-27T08:00:00.000Z'
    });
  });
  await page.route('**/api/settings/model-routing/defaults', async (route) => {
    if (route.request().method() === 'PUT') {
      modelRoutingRequest = await route.request().postDataJSON();
      await fulfillJson(route, {
        ...(modelRoutingRequest as Record<string, unknown>),
        updatedAt: '2026-04-27T08:01:00.000Z'
      });
      return;
    }

    await fulfillJson(route, {
      provider: 'openai',
      draftingModel: 'gpt-draft-default',
      reviewModel: 'gpt-review-default',
      embeddingModel: 'text-embedding-3-small',
      updatedAt: '2026-04-27T08:00:00.000Z'
    });
  });
  await page.route('**/api/settings/budgets/defaults', async (route) => {
    if (route.request().method() === 'PUT') {
      budgetRequest = await route.request().postDataJSON();
      await fulfillJson(route, {
        ...(budgetRequest as Record<string, unknown>),
        updatedAt: '2026-04-27T08:02:00.000Z'
      });
      return;
    }

    await fulfillJson(route, {
      provider: 'openai',
      maxRunCostUsd: 0.75,
      maxDailyCostUsd: 5,
      maxContextTokens: 12000,
      updatedAt: '2026-04-27T08:00:00.000Z'
    });
  });
  await page.route('**/api/settings/source-policy/defaults', async (route) => {
    if (route.request().method() === 'PUT') {
      sourcePolicyRequest = await route.request().postDataJSON();
      await fulfillJson(route, {
        ...(sourcePolicyRequest as Record<string, unknown>),
        updatedAt: '2026-04-27T08:03:00.000Z'
      });
      return;
    }

    await fulfillJson(route, {
      allowUserSamples: false,
      allowLicensedSamples: false,
      allowPublicDomain: true,
      restrictedSourceIds: ['legacy_source'],
      updatedAt: '2026-04-27T08:00:00.000Z'
    });
  });

  await page.goto('/');

  const modelRouting = page.getByLabel('Model routing defaults');
  await expect(modelRouting.getByLabel('Drafting model')).toHaveValue('gpt-draft-default');
  await modelRouting.getByLabel('Drafting model').fill('gpt-draft-e2e');
  await modelRouting.getByLabel('Review model').fill('gpt-review-e2e');
  await modelRouting.getByLabel('Embedding model').fill('text-embedding-3-large');
  await modelRouting.getByRole('button', { name: 'Save model routing defaults' }).click();
  await expect(modelRouting.getByText('Model routing defaults saved.')).toBeVisible();
  expect(modelRoutingRequest).toEqual({
    provider: 'openai',
    draftingModel: 'gpt-draft-e2e',
    reviewModel: 'gpt-review-e2e',
    embeddingModel: 'text-embedding-3-large'
  });

  const budget = page.getByLabel('Budget defaults');
  await budget.getByLabel('Max run cost').fill('1.25');
  await budget.getByLabel('Max daily cost').fill('8.5');
  await budget.getByLabel('Max context tokens').fill('24000');
  await budget.getByRole('button', { name: 'Save budget defaults' }).click();
  await expect(budget.getByText('Budget defaults saved.')).toBeVisible();
  expect(budgetRequest).toEqual({
    provider: 'openai',
    maxRunCostUsd: 1.25,
    maxDailyCostUsd: 8.5,
    maxContextTokens: 24000
  });

  const sourcePolicy = page.getByLabel('Source policy defaults');
  await sourcePolicy.getByLabel('Allow user samples').check();
  await sourcePolicy.getByLabel('Allow licensed samples').check();
  await sourcePolicy.getByLabel('Allow public domain').uncheck();
  await sourcePolicy.getByLabel('Restricted source ids').fill('private_archive, embargoed_notes');
  await sourcePolicy.getByRole('button', { name: 'Save source policy defaults' }).click();
  await expect(sourcePolicy.getByText('Source policy defaults saved.')).toBeVisible();
  expect(sourcePolicyRequest).toEqual({
    allowUserSamples: true,
    allowLicensedSamples: true,
    allowPublicDomain: false,
    restrictedSourceIds: ['private_archive', 'embargoed_notes']
  });
});

test('agent room exposes run inspection signals and actions', async ({ page }) => {
  let actionRequest: { method: string; postData: unknown } | null = null;

  await page.route('**/api/agent-room/runs', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ runs: [agentRoomRun.run] })
    });
  });
  await page.route('**/api/agent-room/runs/agent_run_e2e', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(agentRoomRun)
    });
  });
  await page.route('**/api/agent-room/runs/agent_run_e2e/actions/cancel', async (route) => {
    actionRequest = {
      method: route.request().method(),
      postData: route.request().postDataJSON()
    };
    await fulfillJson(route, { runId: 'agent_run_e2e', action: 'cancel', status: 'accepted' });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Run Inspector' })).toBeVisible();
  await expect(page.getByLabel('Agent runs').getByRole('button').first()).toBeVisible();
  await expect(page.getByLabel('Agent run detail')).toContainText(/Graph|Context|Artifacts|Approvals/);
  await expect(page.getByLabel('Run graph detail')).toBeVisible();
  await expect(page.getByLabel('Context inspector')).toBeVisible();
  await expect(page.getByLabel('Run artifacts')).toBeVisible();
  await expect(page.getByLabel('Run approvals')).toBeVisible();
  await expect(page.getByLabel('Agent run detail')).toContainText(/\$\d+\.\d{3}/);
  await expect(page.getByLabel('Agent run actions')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await expect(page.getByLabel('Agent action result')).toHaveText('Action cancel completed.');
  expect(actionRequest).toEqual({ method: 'POST', postData: {} });
});

test('observability dashboard exposes cost token latency and adoption signals', async ({ page }) => {
  await page.route('**/api/projects/project_1/observability/summary', fulfillObservabilitySummary);
  await page.route('**/api/observability/summary', fulfillObservabilitySummary);

  await page.goto('/');

  const dashboard = page.getByRole('region', { name: 'Observability' });
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByText('Cost', { exact: true })).toBeVisible();
  await expect(dashboard.getByText('$12.35')).toBeVisible();
  await expect(dashboard.getByText('Tokens')).toBeVisible();
  await expect(dashboard.getByText('9,876 total')).toBeVisible();
  await expect(dashboard.getByText('Latency')).toBeVisible();
  await expect(dashboard.getByText('432 ms avg')).toBeVisible();
  await expect(dashboard.getByText('Workflow bottlenecks')).toBeVisible();
  await expect(dashboard.getByText('generate-draft 1,200 ms avg')).toBeVisible();
  await expect(dashboard.getByText('Adoption')).toBeVisible();
  await expect(dashboard.getByText('50% adopted')).toBeVisible();
  await expect(dashboard.getByText('gpt-5-mini 7 runs')).toBeVisible();
});

test('retrieval evaluation shows pass and fail regression evidence', async ({ page }) => {
  await page.route('**/api/retrieval/projects/project_1/regression/run', async (route) => {
    expect(route.request().method()).toBe('POST');
    const body = await route.request().postDataJSON();
    expect(body.included).toBeUndefined();
    expect(body.excluded).toBeUndefined();
    await fulfillJson(route, body.caseId === 'case_retrieval_pass' ? retrievalPassingResult : retrievalFailingResult);
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Retrieval Evaluation' })).toBeVisible();
  const passing = page.getByLabel('Passing retrieval case');
  await expect(passing).toContainText('Passed');
  await expect(passing).toContainText('scene_archive');
  await expect(passing).toContainText('source_public_1');

  const failing = page.getByLabel('Failing retrieval case');
  await expect(failing).toContainText('Failed');
  await expect(failing).toContainText('missing_required');
  await expect(failing).toContainText('forbidden_included');
  await expect(failing).toContainText('scene_secret');
  await expect(failing).toContainText('source_restricted_7');
});

test('review learning shows recurring issues and revision recheck evidence', async ({ page }) => {
  await page.route('**/api/review-learning/recurring-issues', async (route) => {
    expect(route.request().method()).toBe('POST');
    await fulfillJson(route, { recurringIssues });
  });
  await page.route('**/api/review-learning/recheck', async (route) => {
    expect(route.request().method()).toBe('POST');
    await fulfillJson(route, revisionRecheckResult);
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Review Learning' })).toBeVisible();
  const trends = page.getByLabel('Recurring issue trends');
  await expect(trends).toContainText('Continuity:compass changes color');
  await expect(trends).toContainText('3 occurrences');
  await expect(trends).toContainText('Escalating');
  await expect(trends).toContainText('High risk');

  await page.getByRole('button', { name: 'Run recheck' }).click();

  await expect(page.getByLabel('Review learning actions')).toContainText('Regressions 1');
  const lifecycle = page.getByLabel('Revision lifecycle statuses');
  await expect(lifecycle).toContainText('review_finding_fixed');
  await expect(lifecycle).toContainText('Resolved');
  await expect(lifecycle).toContainText('review_finding_open -> review_finding_current');
  await expect(lifecycle).toContainText('StillOpen');
});

const agentRoomRun = {
  run: {
    id: 'agent_run_e2e',
    agentName: 'Writer Agent',
    taskType: 'scene_draft',
    workflowType: 'chapter_creation',
    promptVersionId: 'prompt_scene_v2',
    status: 'Running',
    jobStatus: 'Running',
    createdAt: '2026-04-27T08:00:00.000Z',
    totalCostUsd: 0.013,
    pendingApprovalCount: 1,
    allowedActions: ['cancel'],
    contextPackId: 'context_pack_e2e'
  },
  workflowRun: {
    id: 'workflow_run_e2e',
    taskContractId: 'task_contract_e2e',
    steps: []
  },
  graph: [
    {
      id: 'workflow_run_e2e:1',
      order: 1,
      name: 'build_context',
      status: 'Succeeded',
      artifactIds: ['context_pack_e2e'],
      retryAttempt: 0
    },
    {
      id: 'workflow_run_e2e:2',
      order: 2,
      name: 'draft_scene',
      status: 'Running',
      artifactIds: ['artifact_scene_e2e'],
      retryAttempt: 1
    }
  ],
  contextPack: {
    id: 'context_pack_e2e',
    taskGoal: 'Draft the lock-room reveal',
    agentRole: 'Writer Agent',
    riskLevel: 'High',
    sections: [{ name: 'canon', content: 'The key was hidden in the lantern.' }],
    citations: [{ sourceId: 'fact_key_lantern', quote: 'hidden in the lantern' }],
    exclusions: ['do not reveal the accomplice'],
    warnings: ['Keep the culprit ambiguous.'],
    retrievalTrace: ['chapter:12', 'entity:key'],
    createdAt: '2026-04-27T08:00:00.000Z'
  },
  artifacts: [
    {
      id: 'artifact_scene_e2e',
      type: 'agent_output',
      source: 'agent_run',
      version: 1,
      hash: 'sha256:scene',
      uri: 'memory://scene-draft',
      relatedRunId: 'agent_run_e2e',
      createdAt: '2026-04-27T08:01:00.000Z'
    }
  ],
  approvals: [{ id: 'approval_e2e', runId: 'agent_run_e2e', status: 'Pending', title: 'Publish draft?' }],
  costSummary: {
    totalInputTokens: 1000,
    totalOutputTokens: 300,
    totalCostUsd: 0.013,
    calls: []
  }
};
async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}

async function fulfillObservabilitySummary(route: Route) {
  await fulfillJson(route, {
    cost: { totalUsd: 12.345, averageUsdPerRun: 2.469 },
    latency: { averageDurationMs: 432, p95DurationMs: 900 },
    tokens: { total: 9876, averagePerRun: 1975.2 },
    quality: {
      acceptedRate: 0.75,
      openIssueCount: 4,
      highSeverityOpenCount: 2,
      outcomes: { accepted: 3, needs_revision: 1 }
    },
    adoption: {
      adoptedRate: 0.5,
      partialRate: 0.25,
      rejectedRate: 0.25,
      byFeature: {}
    },
    modelUsage: [
      {
        modelProvider: 'openai',
        modelName: 'gpt-5-mini',
        runCount: 7,
        totalTokens: 9876,
        totalCostUsd: 12.345
      }
    ],
    runErrors: [
      {
        code: 'schema_validation',
        count: 2,
        retryableCount: 1,
        maxSeverity: 'Error'
      }
    ],
    workflowBottlenecks: [
      {
        workflowType: 'draft',
        stepName: 'generate-draft',
        runCount: 3,
        averageDurationMs: 1200,
        failureRate: 0.33,
        retryPressure: 2
      }
    ],
    dataQuality: { openIssueCount: 4, highSeverityOpenCount: 2 }
  });
}

async function routeSelectedProject(page: Page) {
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await fulfillJson(route, [{ id: 'project_1', title: 'Workspace Project' }]);
  });
  await page.route('**/api/projects/project_1', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await fulfillJson(route, { id: 'project_1', title: 'Workspace Project', status: 'Active' });
  });
  await page.route('**/api/projects/project_1/chapters', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await fulfillJson(route, []);
  });
}

const retrievalPassingResult = {
  caseId: 'case_retrieval_pass',
  projectId: 'project_1',
  query: 'archive door clue',
  policyId: 'policy_public_only',
  passed: true,
  summary: { includedCount: 1, excludedCount: 1, failureCount: 0 },
  included: [{ id: 'scene_archive', text: 'Archive door clue' }],
  excluded: [{ id: 'source_public_1', reason: 'low_score' }],
  failures: []
};

const retrievalFailingResult = {
  caseId: 'case_retrieval_fail',
  projectId: 'project_1',
  query: 'archive door clue',
  policyId: 'policy_public_only',
  passed: false,
  summary: { includedCount: 1, excludedCount: 1, failureCount: 2 },
  included: [{ id: 'source_restricted_7', text: 'Restricted dossier' }],
  excluded: [{ id: 'scene_secret', reason: 'filtered_out' }],
  failures: [
    { kind: 'missing_required', id: 'scene_secret', message: 'Required scene was excluded.' },
    { kind: 'forbidden_included', id: 'source_restricted_7', message: 'Forbidden source was included.' }
  ]
};

const readerPromiseResult = {
  promise: { title: 'The locked door' },
  health: 'ReadyForPayoff',
  uiState: { statusLabel: 'ReadyForPayoff', tone: 'success', summary: 'Promise can land now' },
  recommendation: { action: 'PayoffNow', label: 'Pay off in this scene', reason: 'All related entities are present.' }
};

const closureChecklistResult = {
  projectId: 'project_1',
  readyCount: 0,
  blockerCount: 2,
  blockers: [
    { id: 'promise_locked_door', type: 'promise', label: 'The locked door', reason: 'Core promise remains open.' },
    { id: 'arc_mira_truth', type: 'characterArc', label: 'Mira arc', reason: 'Major arc remains open.' }
  ]
};

const narrativeSummaryResult = {
  projectId: 'project_1',
  currentChapter: 7,
  promiseStates: [
    {
      id: 'promise_locked_door',
      title: 'The locked door',
      health: readerPromiseResult.health,
      uiState: readerPromiseResult.uiState,
      recommendation: readerPromiseResult.recommendation
    }
  ],
  closure: closureChecklistResult
};

const authorshipAllowedResult = {
  allowed: true,
  action: 'accept_manuscript_version',
  status: 'Allowed',
  approvalRequired: true,
  approvalReasons: ['Human acceptance required'],
  blockers: []
};

const authorshipBlockedResult = {
  allowed: false,
  action: 'overwrite_manuscript_version',
  status: 'Blocked',
  approvalRequired: true,
  approvalReasons: ['Approval required for overwrite'],
  blockers: ['Missing human approval']
};

const scheduledBackupPolicy = {
  id: 'policy_daily',
  projectId: 'project_demo',
  cadence: 'daily',
  targetPathPrefix: 'memory://backups',
  enabled: true,
  lastRunAt: '2026-04-26T12:00:00.000Z',
  nextRunAt: '2026-04-27T12:00:00.000Z',
  retentionCount: 7,
  lastRunStatus: 'Succeeded'
};

const scheduledBackupUpdatedPolicy = {
  ...scheduledBackupPolicy,
  lastRunAt: '2026-04-27T12:00:00.000Z',
  nextRunAt: '2026-04-28T12:00:00.000Z',
  lastRunStatus: 'Succeeded'
};

const scheduledBackupDueResult = {
  policies: [scheduledBackupPolicy],
  intents: [
    {
      id: 'backup:project_demo:policy_daily',
      policyId: 'policy_daily',
      projectId: 'project_demo',
      targetPathPrefix: 'memory://backups',
      scheduledAt: '2026-04-27T12:00:00.000Z'
    }
  ]
};

const branchProjectResult = {
  scenario: {
    id: 'branch_moonlit_archive',
    projectId: 'project_1',
    title: 'Moonlit Archive Branch',
    baseCanonFactIds: ['canon_archive'],
    artifacts: [{ id: 'artifact_branch_scene', kind: 'scene', content: 'Mira finds the hidden key.' }]
  },
  projection: {
    baseCanonFactIds: ['canon_archive'],
    addedArtifactIds: ['artifact_branch_scene'],
    conflicts: []
  }
};

const branchAdoptResult = {
  canon: {
    canonFactIds: ['canon_archive', 'canon_hidden_key'],
    artifactIds: ['artifact_draft_1', 'artifact_branch_scene']
  }
};

const retconProposalResult = {
  proposal: {
    id: 'retcon_locked_door_origin',
    title: 'Change locked door origin',
    target: { type: 'canon_fact', id: 'canon_archive' },
    before: 'The door was sealed by the city.',
    after: 'The door was sealed by Mira mother.',
    affected: {
      canonFacts: ['canon_archive'],
      manuscriptChapters: ['chapter_3'],
      timelineEvents: ['timeline_event_2'],
      promises: ['promise_locked_door'],
      secrets: [],
      worldRules: []
    },
    regressionChecks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
  },
  regression: {
    passed: false,
    checks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
  }
};

const retconRegressionResult = {
  passed: false,
  checks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
};

const recurringIssues = [
  {
    signature: 'Continuity:compass changes color',
    category: 'Continuity',
    occurrenceCount: 3,
    chapterIds: ['chapter_1', 'chapter_2', 'chapter_3'],
    findingIds: ['review_finding_1', 'review_finding_2', 'review_finding_3'],
    highestSeverity: 'High',
    trend: 'Escalating',
    risk: 'High'
  }
];

const revisionRecheckResult = {
  previousManuscriptVersionId: 'chapter_1_v1',
  currentManuscriptVersionId: 'chapter_1_v2',
  statuses: [
    { findingId: 'review_finding_fixed', status: 'Resolved' },
    { findingId: 'review_finding_open', status: 'StillOpen', currentFindingId: 'review_finding_current' }
  ],
  regressions: [
    {
      finding: reviewFinding({ id: 'review_finding_regressed', status: 'Regression' }),
      event: {
        id: 'review_learning_1',
        findingId: 'review_finding_regressed',
        kind: 'Regression',
        previousStatus: 'Resolved',
        nextStatus: 'Regression',
        manuscriptVersionId: 'chapter_1_v2',
        detectedByFindingId: 'review_finding_current',
        occurredAt: '2026-04-27T12:00:00.000Z'
      }
    }
  ],
  recurringIssues
};

function reviewFinding(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review_finding_1',
    manuscriptVersionId: 'chapter_1_v1',
    category: 'Continuity',
    severity: 'Medium',
    problem: 'Compass changes color',
    evidenceCitations: [{ sourceId: 'chapter_1', quote: 'The compass was brass.' }],
    impact: 'Reader cannot track the object.',
    fixOptions: ['Keep the compass brass.'],
    autoFixRisk: 'Low',
    status: 'Open',
    ...overrides
  };
}

const exportBundleResult = {
  job: {
    id: 'export_job_1',
    type: 'export.bundle',
    status: 'Queued',
    projectId: 'project_1',
    payload: { includeArtifacts: true }
  },
  bundle: {
    id: 'export_bundle_1',
    projectId: 'project_1',
    status: 'Queued',
    uri: 'memory://project_1/export.zip'
  }
};

const importJobResult = {
  job: {
    id: 'import_job_1',
    type: 'import.project',
    status: 'Queued',
    projectId: 'project_1',
    payload: { sourceUri: 'memory://project_1/export.zip', mode: 'replace' }
  }
};
