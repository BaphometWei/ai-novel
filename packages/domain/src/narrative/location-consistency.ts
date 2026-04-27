import type { CharacterLocationAppearance, TravelDuration } from './timeline';

export type LocationViolationType = 'impossible_travel' | 'missing_travel_duration_rule';
export type LocationViolationSeverity = 'Medium' | 'Blocking';
export type FalsePositiveTolerance = 'Low' | 'Medium' | 'High';

export interface LocationDistance {
  fromLocationId: string;
  toLocationId: string;
  distanceKm: number;
}

export interface LocationConsistencyViolation {
  type: LocationViolationType;
  severity: LocationViolationSeverity;
  characterId: string;
  eventIds: string[];
  locationIds: string[];
  evidence: string;
  confidence: number;
  falsePositiveTolerance: FalsePositiveTolerance;
}

export interface LocationConsistencyResult {
  accepted: boolean;
  violations: LocationConsistencyViolation[];
}

export function validateLocationConsistency(input: {
  appearances: CharacterLocationAppearance[];
  travelDurations: TravelDuration[];
  distances?: LocationDistance[];
}): LocationConsistencyResult {
  const violations: LocationConsistencyViolation[] = [];
  const characterIds = [...new Set(input.appearances.flatMap((appearance) => appearance.characterIds))].sort();

  for (const characterId of characterIds) {
    const appearances = input.appearances
      .filter((appearance) => appearance.characterIds.includes(characterId))
      .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.eventId.localeCompare(right.eventId));

    for (let index = 1; index < appearances.length; index += 1) {
      const previous = appearances[index - 1];
      const current = appearances[index];
      if (previous.locationId === current.locationId) continue;

      const elapsedMinutes = Math.floor(
        (Date.parse(current.startsAt) - Date.parse(previous.endsAt ?? previous.startsAt)) / 60000
      );
      const duration = findTravelDuration(previous.locationId, current.locationId, input.travelDurations);
      const distance = findDistance(previous.locationId, current.locationId, input.distances ?? []);

      if (!duration) {
        violations.push({
          type: 'missing_travel_duration_rule',
          severity: 'Medium',
          characterId,
          eventIds: [previous.eventId, current.eventId],
          locationIds: [previous.locationId, current.locationId],
          evidence: `No travel-duration rule exists for ${previous.locationId} to ${current.locationId}; ${distance ? `known distance is ${distance.distanceKm} km` : 'distance is unknown'}.`,
          confidence: 0.75,
          falsePositiveTolerance: 'Medium'
        });
        continue;
      }

      if (elapsedMinutes < duration.minimumDurationMinutes) {
        violations.push({
          type: 'impossible_travel',
          severity: 'Blocking',
          characterId,
          eventIds: [previous.eventId, current.eventId],
          locationIds: [previous.locationId, current.locationId],
          evidence: `${characterId} has ${elapsedMinutes} minutes to travel from ${previous.locationId} to ${current.locationId}, but the minimum is ${duration.minimumDurationMinutes} minutes${distance ? ` over ${distance.distanceKm} km` : ''}.`,
          confidence: 1,
          falsePositiveTolerance: 'Low'
        });
      }
    }
  }

  violations.sort(
    (left, right) =>
      left.eventIds[0].localeCompare(right.eventIds[0]) ||
      left.eventIds[1].localeCompare(right.eventIds[1]) ||
      left.type.localeCompare(right.type)
  );
  return { accepted: violations.length === 0, violations };
}

function findTravelDuration(
  fromLocationId: string,
  toLocationId: string,
  travelDurations: TravelDuration[]
): TravelDuration | undefined {
  return travelDurations.find(
    (duration) =>
      (duration.fromLocationId === fromLocationId && duration.toLocationId === toLocationId) ||
      (duration.fromLocationId === toLocationId && duration.toLocationId === fromLocationId)
  );
}

function findDistance(
  fromLocationId: string,
  toLocationId: string,
  distances: LocationDistance[]
): LocationDistance | undefined {
  return distances.find(
    (distance) =>
      (distance.fromLocationId === fromLocationId && distance.toLocationId === toLocationId) ||
      (distance.fromLocationId === toLocationId && distance.toLocationId === fromLocationId)
  );
}
