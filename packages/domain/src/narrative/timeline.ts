export interface TimelineEndpoint {
  eventId: string;
  occursAt: string;
}

export interface CausalLink {
  cause: TimelineEndpoint;
  effect: TimelineEndpoint;
  description: string;
}

export function createCausalLink(input: CausalLink): CausalLink {
  if (Date.parse(input.effect.occursAt) < Date.parse(input.cause.occursAt)) {
    throw new Error('Causal link effect cannot occur before its cause');
  }

  return input;
}

export interface CharacterLocationAppearance {
  eventId: string;
  characterIds: string[];
  locationId: string;
  startsAt: string;
  endsAt?: string;
}

export interface TravelDuration {
  fromLocationId: string;
  toLocationId: string;
  minimumDurationMinutes: number;
}

export function assertCharacterLocationContinuity(
  appearances: CharacterLocationAppearance[],
  travelDurations: TravelDuration[]
): void {
  const characterIds = [...new Set(appearances.flatMap((appearance) => appearance.characterIds))];

  for (const characterId of characterIds) {
    const characterAppearances = appearances
      .filter((appearance) => appearance.characterIds.includes(characterId))
      .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));

    for (let index = 1; index < characterAppearances.length; index += 1) {
      const previous = characterAppearances[index - 1];
      const current = characterAppearances[index];

      if (previous.locationId === current.locationId) {
        continue;
      }

      const travelDuration = findTravelDuration(previous.locationId, current.locationId, travelDurations);
      if (!travelDuration) {
        continue;
      }

      const elapsedMinutes = Math.floor(
        (Date.parse(current.startsAt) - Date.parse(previous.endsAt ?? previous.startsAt)) / 60000
      );

      if (elapsedMinutes < travelDuration.minimumDurationMinutes) {
        throw new Error(
          `Character ${characterId} cannot travel from ${previous.locationId} to ${current.locationId} in ${elapsedMinutes} minutes`
        );
      }
    }
  }
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
