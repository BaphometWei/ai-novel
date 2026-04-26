export interface Clock {
  now(): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString()
};

export function createFixedClock(timestamp: string): Clock {
  return {
    now: () => timestamp
  };
}
