export type TimelineViolationType = 'missed_deadline' | 'concurrent_event_conflict' | 'causality_order_error';
export type TimelineViolationSeverity = 'Medium' | 'High' | 'Blocking';
export type FalsePositiveTolerance = 'Low' | 'Medium' | 'High';

export interface TimelineEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  characterIds?: string[];
}

export interface TimelineDeadline {
  id: string;
  eventId: string;
  dueAt: string;
  description: string;
}

export interface TimelineCausalLink {
  causeEventId: string;
  effectEventId: string;
  description: string;
}

export interface TimelineConsistencyViolation {
  type: TimelineViolationType;
  severity: TimelineViolationSeverity;
  eventIds: string[];
  evidence: string;
  confidence: number;
  falsePositiveTolerance: FalsePositiveTolerance;
}

export interface TimelineConsistencyResult {
  accepted: boolean;
  violations: TimelineConsistencyViolation[];
}

export function validateTimelineConsistency(input: {
  events: TimelineEvent[];
  deadlines?: TimelineDeadline[];
  causalLinks?: TimelineCausalLink[];
}): TimelineConsistencyResult {
  const events = [...input.events].sort(compareEvents);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const violations: TimelineConsistencyViolation[] = [];

  for (const [left, right, characterId] of overlappingCharacterEvents(events)) {
    violations.push({
      type: 'concurrent_event_conflict',
      severity: 'High',
      eventIds: [left.id, right.id],
      evidence: `${characterId} appears in ${left.id} and ${right.id} during overlapping time windows.`,
      confidence: 0.98,
      falsePositiveTolerance: 'Low'
    });
  }

  for (const link of input.causalLinks ?? []) {
    const cause = eventById.get(link.causeEventId);
    const effect = eventById.get(link.effectEventId);
    if (!cause || !effect) continue;

    if (Date.parse(cause.startsAt) > Date.parse(effect.startsAt)) {
      violations.push({
        type: 'causality_order_error',
        severity: 'Blocking',
        eventIds: [link.causeEventId, link.effectEventId],
        evidence: `${link.causeEventId} is listed as causing ${link.effectEventId}, but starts after it.`,
        confidence: 1,
        falsePositiveTolerance: 'Low'
      });
    }
  }

  for (const deadline of input.deadlines ?? []) {
    const event = eventById.get(deadline.eventId);
    if (!event) continue;

    if (Date.parse(event.startsAt) > Date.parse(deadline.dueAt)) {
      violations.push({
        type: 'missed_deadline',
        severity: 'High',
        eventIds: [event.id],
        evidence: `${event.id} starts at ${event.startsAt} after deadline ${deadline.id} at ${deadline.dueAt}.`,
        confidence: 1,
        falsePositiveTolerance: 'Low'
      });
    }
  }

  violations.sort(compareViolations);
  return { accepted: violations.length === 0, violations };
}

function overlappingCharacterEvents(events: TimelineEvent[]): Array<[TimelineEvent, TimelineEvent, string]> {
  const pairs: Array<[TimelineEvent, TimelineEvent, string]> = [];

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
      const left = events[leftIndex];
      const right = events[rightIndex];
      const sharedCharacterId = [...(left.characterIds ?? [])]
        .sort()
        .find((characterId) => (right.characterIds ?? []).includes(characterId));

      if (sharedCharacterId && rangesOverlap(left, right)) {
        pairs.push([left, right, sharedCharacterId]);
      }
    }
  }

  return pairs;
}

function rangesOverlap(left: TimelineEvent, right: TimelineEvent): boolean {
  const leftStart = Date.parse(left.startsAt);
  const leftEnd = Date.parse(left.endsAt ?? left.startsAt);
  const rightStart = Date.parse(right.startsAt);
  const rightEnd = Date.parse(right.endsAt ?? right.startsAt);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function compareEvents(left: TimelineEvent, right: TimelineEvent): number {
  return Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.id.localeCompare(right.id);
}

function compareViolations(left: TimelineConsistencyViolation, right: TimelineConsistencyViolation): number {
  return violationRank(left.type) - violationRank(right.type) || left.eventIds.join(':').localeCompare(right.eventIds.join(':'));
}

function violationRank(type: TimelineViolationType): number {
  return ['concurrent_event_conflict', 'causality_order_error', 'missed_deadline'].indexOf(type);
}
