export function createClosureChecklist(input: {
  projectId: string;
  promises: Array<{
    id: string;
    importance: string;
    status: string;
    summary: string;
    payoffWindow?: { startChapter: number; endChapter: number };
    currentChapter?: number;
  }>;
  characterArcs: Array<{
    id: string;
    characterId: string;
    importance: string;
    status: string;
    summary: string;
    currentChapter?: number;
    targetChapter?: number;
  }>;
}) {
  const promiseItems = input.promises
    .filter((promise) => promise.importance === 'Core' && promise.status !== 'Closed' && promise.status !== 'Resolved')
    .map((promise) => ({
      sourceType: 'ReaderPromise',
      sourceId: promise.id,
      severity: 'Blocking',
      risk: getPromiseClosureRisk(promise),
      status: 'NeedsResolution',
      label: `Resolve Core promise: ${promise.summary}`
    }));

  const arcItems = input.characterArcs
    .filter((arc) => arc.importance === 'Major' && arc.status !== 'Closed' && arc.status !== 'Resolved')
    .map((arc) => ({
      sourceType: 'CharacterArc',
      sourceId: arc.id,
      severity: 'Blocking',
      risk: getArcClosureRisk(arc),
      status: 'NeedsResolution',
      label: `Close major character arc: ${arc.summary}`
    }));

  return {
    projectId: input.projectId,
    items: [...promiseItems, ...arcItems]
  };
}

type ClosureSeverity = 'Blocking' | 'High' | 'Medium';

interface FinalPayoffItem {
  sourceType:
    | 'Plotline'
    | 'CharacterArc'
    | 'ReaderPromise'
    | 'Secret'
    | 'WorldRule'
    | 'AntagonistOutcome'
    | 'ReaderContract'
    | 'OpenQuestion';
  sourceId: string;
  status: string;
  severity: ClosureSeverity;
  label: string;
  recommendation?: string;
}

interface FinalPayoffInput {
  projectId: string;
  plotlines: Array<{
    id: string;
    title: string;
    importance: string;
    status: string;
    finalPayoff?: string;
  }>;
  characterArcs: Array<{
    id: string;
    characterId: string;
    importance: string;
    status: string;
    summary: string;
    finalState?: string;
  }>;
  readerPromises: Array<{
    id: string;
    strength: string;
    status: string;
    title: string;
    payoff?: string;
  }>;
  secrets: Array<{
    id: string;
    status: string;
    title: string;
    plannedReveal?: string;
    evidenceSupported?: boolean;
  }>;
  worldRules: Array<{
    id: string;
    title: string;
    consequenceStatus: string;
    expectedConsequence?: string;
  }>;
  antagonistOutcome?: {
    antagonistId: string;
    status: string;
    expectedOutcome?: string;
  };
  readerContract?: {
    status: string;
    expectation: string;
  };
  openQuestions: Array<{
    id: string;
    question: string;
    decision: 'Answer' | 'LeaveOpen';
  }>;
}

export function createFinalPayoffPlan(input: FinalPayoffInput) {
  const items: FinalPayoffItem[] = [];
  const blockers: string[] = [];
  const recommendations: string[] = [];

  for (const plotline of input.plotlines) {
    if (plotline.importance !== 'Core' || isResolved(plotline.status)) continue;

    items.push({
      sourceType: 'Plotline',
      sourceId: plotline.id,
      status: 'NeedsPayoff',
      severity: 'Blocking',
      label: `Pay off plotline: ${plotline.title}`,
      recommendation: plotline.finalPayoff
    });
    blockers.push(`Core plotline ${plotline.id} still needs final payoff.`);
  }

  for (const arc of input.characterArcs) {
    if (arc.importance !== 'Major' || isResolved(arc.status)) continue;

    items.push({
      sourceType: 'CharacterArc',
      sourceId: arc.id,
      status: 'NeedsClosure',
      severity: 'High',
      label: `Close character arc: ${arc.summary}`,
      recommendation: arc.finalState
    });
  }

  for (const promise of input.readerPromises) {
    if (promise.strength !== 'Core' || isResolved(promise.status)) continue;

    items.push({
      sourceType: 'ReaderPromise',
      sourceId: promise.id,
      status: 'NeedsPayoff',
      severity: 'Blocking',
      label: `Pay off Core promise: ${promise.title}`,
      recommendation: promise.payoff
    });
    blockers.push(`Core reader promise ${promise.id} is unresolved.`);
  }

  for (const secret of input.secrets) {
    if (secret.status === 'Revealed' && secret.evidenceSupported !== false) continue;

    if (secret.evidenceSupported === false) {
      items.push({
        sourceType: 'Secret',
        sourceId: secret.id,
        status: 'NeedsRevealSupport',
        severity: 'Blocking',
        label: `Support final reveal: ${secret.title}`,
        recommendation: secret.plannedReveal
      });
      blockers.push(`Secret ${secret.id} reveal lacks supporting evidence.`);
    }
  }

  for (const rule of input.worldRules) {
    if (rule.consequenceStatus !== 'Broken') continue;

    items.push({
      sourceType: 'WorldRule',
      sourceId: rule.id,
      status: 'NeedsConsequence',
      severity: 'Blocking',
      label: `Restore world-rule consequence: ${rule.title}`,
      recommendation: rule.expectedConsequence
    });
    blockers.push(`World rule ${rule.id} has a broken final consequence.`);
  }

  if (input.antagonistOutcome?.status === 'Missing') {
    items.push({
      sourceType: 'AntagonistOutcome',
      sourceId: input.antagonistOutcome.antagonistId,
      status: 'MissingOutcome',
      severity: 'Blocking',
      label: `Resolve antagonist outcome: ${input.antagonistOutcome.antagonistId}`,
      recommendation: input.antagonistOutcome.expectedOutcome
    });
    blockers.push(`Antagonist outcome is missing for ${input.antagonistOutcome.antagonistId}.`);
  }

  if (input.readerContract?.status === 'AtRisk') {
    items.push({
      sourceType: 'ReaderContract',
      sourceId: 'reader_contract',
      status: 'AtRisk',
      severity: 'High',
      label: 'Honor reader contract',
      recommendation: input.readerContract.expectation
    });
  }

  for (const question of input.openQuestions) {
    items.push({
      sourceType: 'OpenQuestion',
      sourceId: question.id,
      status: 'DecisionRecorded',
      severity: 'Medium',
      label: `${question.decision === 'Answer' ? 'Answer' : 'Leave'} open question: ${question.question}`,
      recommendation: question.decision
    });
  }

  if (blockers.length > 0) {
    recommendations.push('Resolve blocking closure items before drafting the final ending.');
  }

  return {
    projectId: input.projectId,
    items,
    blockers,
    recommendations
  };
}

export function shouldRunClosureChecks(input: {
  isFinalVolume?: boolean;
  requestType?: string;
  majorArcs?: Array<{ id: string; status: string; progressToResolution?: number }>;
}) {
  return (
    input.isFinalVolume === true ||
    input.requestType === 'EndingPlanning' ||
    (input.majorArcs ?? []).some(
      (arc) => arc.status === 'Resolving' || (arc.progressToResolution ?? 0) >= 0.8
    )
  );
}

function getPromiseClosureRisk(promise: { payoffWindow?: { endChapter: number }; currentChapter?: number }) {
  if (promise.currentChapter === undefined || !promise.payoffWindow) return 'Open';
  if (promise.currentChapter > promise.payoffWindow.endChapter) return 'Overdue';
  if (promise.currentChapter >= promise.payoffWindow.endChapter - 1) return 'DueSoon';
  return 'Open';
}

function getArcClosureRisk(arc: { currentChapter?: number; targetChapter?: number }) {
  if (arc.currentChapter === undefined || arc.targetChapter === undefined) return 'Open';
  if (arc.currentChapter > arc.targetChapter) return 'Overdue';
  if (arc.currentChapter >= arc.targetChapter - 1) return 'DueSoon';
  return 'Open';
}

function isResolved(status: string) {
  return status === 'Closed' || status === 'Resolved' || status === 'Fulfilled' || status === 'PaidOff';
}
