export interface RetrievalQualityThresholds {
  requiredCoverage: number;
  forbiddenLeakage: number;
}

export interface QualityThresholdConfig {
  source: string;
  retrieval: RetrievalQualityThresholds;
}

export const defaultQualityThresholdConfig: QualityThresholdConfig = {
  source: 'synthetic-local-defaults',
  retrieval: {
    requiredCoverage: 1,
    forbiddenLeakage: 0
  }
};

export function parseQualityThresholdConfig(input: unknown = {}): QualityThresholdConfig {
  if (!isRecord(input)) return defaultQualityThresholdConfig;
  const retrieval = isRecord(input.retrieval) ? input.retrieval : {};

  return {
    source: typeof input.source === 'string' && input.source.length > 0 ? input.source : defaultQualityThresholdConfig.source,
    retrieval: {
      requiredCoverage: normalizedThreshold(
        retrieval.requiredCoverage,
        defaultQualityThresholdConfig.retrieval.requiredCoverage,
        'requiredCoverage'
      ),
      forbiddenLeakage: normalizedThreshold(
        retrieval.forbiddenLeakage,
        defaultQualityThresholdConfig.retrieval.forbiddenLeakage,
        'forbiddenLeakage'
      )
    }
  };
}

function normalizedThreshold(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid quality threshold: ${field}`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
