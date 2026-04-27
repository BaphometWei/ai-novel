import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { budgetPolicies, providerSettings } from '../schema';

const COST_SCALE = 1_000_000_000;
const SECRET_KEYS = new Set(['apikey', 'secret', 'token', 'accesstoken', 'refreshtoken']);
const REDACTED_VALUE = '[redacted]';

export interface ProviderSettings {
  provider: string;
  defaultModel: string;
  secretRef: string;
  redactedMetadata: Record<string, unknown>;
  updatedAt: string;
}

export type ProviderSettingsSaveInput = ProviderSettings & {
  apiKey?: string;
};

export interface BudgetPolicy {
  provider: string;
  maxRunCostUsd: number;
  updatedAt: string;
}

export class SettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveProviderSettings(settings: ProviderSettingsSaveInput): Promise<void> {
    const redactedMetadataJson = JSON.stringify(redactSecrets(settings.redactedMetadata));

    await this.db
      .insert(providerSettings)
      .values({
        provider: settings.provider,
        defaultModel: settings.defaultModel,
        secretRef: settings.secretRef,
        redactedMetadataJson,
        updatedAt: settings.updatedAt
      })
      .onConflictDoUpdate({
        target: providerSettings.provider,
        set: {
          defaultModel: settings.defaultModel,
          secretRef: settings.secretRef,
          redactedMetadataJson,
          updatedAt: settings.updatedAt
        }
      });
  }

  async findProviderSettings(provider: string): Promise<ProviderSettings | null> {
    const row = await this.db.select().from(providerSettings).where(eq(providerSettings.provider, provider)).get();
    if (!row) return null;

    return {
      provider: row.provider,
      defaultModel: row.defaultModel,
      secretRef: row.secretRef,
      redactedMetadata: JSON.parse(row.redactedMetadataJson) as Record<string, unknown>,
      updatedAt: row.updatedAt
    };
  }

  async saveBudgetPolicy(policy: BudgetPolicy): Promise<void> {
    const scaledMaxRunCostUsd = Math.round(policy.maxRunCostUsd * COST_SCALE);

    await this.db
      .insert(budgetPolicies)
      .values({
        provider: policy.provider,
        maxRunCostUsd: scaledMaxRunCostUsd,
        updatedAt: policy.updatedAt
      })
      .onConflictDoUpdate({
        target: budgetPolicies.provider,
        set: {
          maxRunCostUsd: scaledMaxRunCostUsd,
          updatedAt: policy.updatedAt
        }
      });
  }

  async findBudgetPolicy(provider: string): Promise<BudgetPolicy | null> {
    const row = await this.db.select().from(budgetPolicies).where(eq(budgetPolicies.provider, provider)).get();
    if (!row) return null;

    return {
      provider: row.provider,
      maxRunCostUsd: row.maxRunCostUsd / COST_SCALE,
      updatedAt: row.updatedAt
    };
  }
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        isSecretKey(key) ? REDACTED_VALUE : redactSecrets(child)
      ])
    );
  }

  return value;
}

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
}
