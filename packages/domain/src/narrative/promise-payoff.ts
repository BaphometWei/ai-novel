import type { ReaderPromise, ReaderPromiseEvidence } from './promises';

export type PromisePayoffQualityCode = 'early' | 'late' | 'too_small' | 'too_large' | 'unsupported' | 'conflicting';

export interface PromisePayoffQualityFinding {
  code: PromisePayoffQualityCode;
  severity: 'Low' | 'Medium' | 'High';
  message: string;
  evidence: ReaderPromiseEvidence[];
}

export function evaluatePromisePayoffQuality(
  promise: ReaderPromise,
  payoff: {
    chapterId: string;
    chapterNumber: number;
    payoffText: string;
    supportingEvidence?: ReaderPromiseEvidence[];
  }
): {
  classification: 'satisfying' | 'needs_revision';
  falsePositiveTolerance: 'allow_author_override';
  findings: PromisePayoffQualityFinding[];
} {
  const evidence = payoff.supportingEvidence?.length ? payoff.supportingEvidence : promise.evidence;
  const findings: PromisePayoffQualityFinding[] = [];

  if (payoff.chapterNumber < promise.payoffWindow.startChapter) {
    findings.push(createFinding('early', 'Medium', 'Payoff appears before the planned payoff window.', evidence));
  }

  if (payoff.chapterNumber > promise.payoffWindow.endChapter) {
    findings.push(createFinding('late', 'Medium', 'Payoff appears after the planned payoff window.', evidence));
  }

  if (isTooSmall(promise, payoff.payoffText)) {
    findings.push(createFinding('too_small', 'High', 'Payoff does not answer the reader expectation strongly enough.', evidence));
  }

  if (isTooLarge(payoff.payoffText)) {
    findings.push(createFinding('too_large', 'Medium', 'Payoff resolves more story material than the promise prepared.', evidence));
  }

  if (isUnsupported(payoff.payoffText, evidence)) {
    findings.push(createFinding('unsupported', 'High', 'Payoff lacks enough prior support in the supplied evidence.', evidence));
  }

  if (isConflicting(payoff.payoffText)) {
    findings.push(createFinding('conflicting', 'High', 'Payoff appears to conflict with established promise evidence.', evidence));
  }

  return {
    classification: findings.length === 0 ? 'satisfying' : 'needs_revision',
    falsePositiveTolerance: 'allow_author_override',
    findings
  };
}

function createFinding(
  code: PromisePayoffQualityCode,
  severity: PromisePayoffQualityFinding['severity'],
  message: string,
  evidence: ReaderPromiseEvidence[]
): PromisePayoffQualityFinding {
  return { code, severity, message, evidence };
}

function isTooSmall(promise: ReaderPromise, payoffText: string) {
  const lower = payoffText.toLowerCase();
  const minimizers = ['only learns', 'merely', 'just learns', 'once belonged'];

  return promise.strength === 'Core' && minimizers.some((term) => lower.includes(term));
}

function isTooLarge(payoffText: string) {
  const lower = payoffText.toLowerCase();
  const expansionTerms = ['lost gods', 'every murder', 'rewrites the entire', 'entire succession'];
  return expansionTerms.filter((term) => lower.includes(term)).length >= 2;
}

function isUnsupported(payoffText: string, evidence: ReaderPromiseEvidence[]) {
  const lower = payoffText.toLowerCase();
  if (!lower.includes('meteor')) return false;

  return !evidence.some((item) => item.excerpt.toLowerCase().includes('meteor'));
}

function isConflicting(payoffText: string) {
  const lower = payoffText.toLowerCase();
  return lower.includes('destroyed') || lower.includes('never mentioned');
}
