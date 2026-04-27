import {
  createBudgetDefaults,
  createModelRoutingDefaults,
  createProviderDefaults,
  createSourcePolicyDefaults,
  type BudgetDefaults,
  type ModelRoutingDefaults,
  type ProviderDefaults,
  type SourcePolicyDefaults
} from '@ai-novel/domain';

export interface ProviderSettingsStore {
  saveProviderSettings(settings: ProviderDefaults): Promise<void>;
  findProviderSettings(provider: string): Promise<ProviderDefaults | null>;
  saveBudgetPolicy(policy: Pick<BudgetDefaults, 'provider' | 'maxRunCostUsd' | 'updatedAt'>): Promise<void>;
  findBudgetPolicy(provider: string): Promise<Pick<BudgetDefaults, 'provider' | 'maxRunCostUsd' | 'updatedAt'> | null>;
}

export interface SettingsDefaultsStore {
  saveModelRoutingDefaults(settings: ModelRoutingDefaults): Promise<void>;
  findModelRoutingDefaults(): Promise<ModelRoutingDefaults | null>;
  saveBudgetDefaults(settings: BudgetDefaults): Promise<void>;
  findBudgetDefaults(): Promise<BudgetDefaults | null>;
  saveSourcePolicyDefaults(settings: SourcePolicyDefaults): Promise<void>;
  findSourcePolicyDefaults(): Promise<SourcePolicyDefaults | null>;
}

export interface SaveProviderDefaultsInput {
  provider: string;
  model: string;
  apiKey?: string;
  secretRef?: string;
  maxRunCostUsd?: number;
  metadata?: Record<string, unknown>;
}

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_TEXT_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_MAX_RUN_COST_USD = 0.25;
const DEFAULT_MAX_DAILY_COST_USD = 5;
const DEFAULT_MAX_CONTEXT_TOKENS = 16000;

export class SettingsService {
  private readonly defaults: SettingsDefaultsStore;

  constructor(
    private readonly providerStore: ProviderSettingsStore = new InMemoryProviderSettingsStore(),
    defaultsStore?: SettingsDefaultsStore
  ) {
    this.defaults = defaultsStore ?? new InMemorySettingsDefaultsStore();
  }

  async saveProviderDefaults(input: SaveProviderDefaultsInput) {
    const provider = createProviderDefaults(input);
    await this.providerStore.saveProviderSettings(provider);

    if (input.maxRunCostUsd !== undefined) {
      const budget = createBudgetDefaults({ provider: input.provider, maxRunCostUsd: input.maxRunCostUsd });
      await this.providerStore.saveBudgetPolicy({
        provider: budget.provider,
        maxRunCostUsd: budget.maxRunCostUsd,
        updatedAt: budget.updatedAt
      });
      return { ...provider, budget: { maxRunCostUsd: budget.maxRunCostUsd } };
    }

    const budget = await this.providerStore.findBudgetPolicy(input.provider);
    return { ...provider, ...(budget ? { budget: { maxRunCostUsd: budget.maxRunCostUsd } } : {}) };
  }

  async findProviderDefaults(provider: string) {
    const settings = await this.providerStore.findProviderSettings(provider);
    if (!settings) return createProviderDefaults({ provider, model: DEFAULT_TEXT_MODEL });
    const budget = await this.providerStore.findBudgetPolicy(provider);
    return { ...settings, ...(budget ? { budget: { maxRunCostUsd: budget.maxRunCostUsd } } : {}) };
  }

  async saveModelRoutingDefaults(input: Omit<ModelRoutingDefaults, 'updatedAt'>) {
    const settings = createModelRoutingDefaults(input);
    await this.defaults.saveModelRoutingDefaults(settings);
    return settings;
  }

  async findModelRoutingDefaults() {
    return (
      (await this.defaults.findModelRoutingDefaults()) ??
      createModelRoutingDefaults({
        provider: DEFAULT_PROVIDER,
        draftingModel: DEFAULT_TEXT_MODEL,
        reviewModel: DEFAULT_TEXT_MODEL,
        embeddingModel: DEFAULT_EMBEDDING_MODEL
      })
    );
  }

  async saveBudgetDefaults(input: Omit<BudgetDefaults, 'updatedAt'>) {
    const settings = createBudgetDefaults(input);
    await this.defaults.saveBudgetDefaults(settings);
    return settings;
  }

  async findBudgetDefaults() {
    return (
      (await this.defaults.findBudgetDefaults()) ??
      createBudgetDefaults({
        provider: DEFAULT_PROVIDER,
        maxRunCostUsd: DEFAULT_MAX_RUN_COST_USD,
        maxDailyCostUsd: DEFAULT_MAX_DAILY_COST_USD,
        maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS
      })
    );
  }

  async saveSourcePolicyDefaults(input: Partial<Omit<SourcePolicyDefaults, 'updatedAt'>>) {
    const settings = createSourcePolicyDefaults(input);
    await this.defaults.saveSourcePolicyDefaults(settings);
    return settings;
  }

  async findSourcePolicyDefaults() {
    return (await this.defaults.findSourcePolicyDefaults()) ?? createSourcePolicyDefaults({});
  }
}

class InMemoryProviderSettingsStore implements ProviderSettingsStore {
  private readonly providers = new Map<string, ProviderDefaults>();
  private readonly budgets = new Map<string, Pick<BudgetDefaults, 'provider' | 'maxRunCostUsd' | 'updatedAt'>>();

  async saveProviderSettings(settings: ProviderDefaults): Promise<void> {
    this.providers.set(settings.provider, settings);
  }

  async findProviderSettings(provider: string): Promise<ProviderDefaults | null> {
    return this.providers.get(provider) ?? null;
  }

  async saveBudgetPolicy(policy: Pick<BudgetDefaults, 'provider' | 'maxRunCostUsd' | 'updatedAt'>): Promise<void> {
    this.budgets.set(policy.provider, policy);
  }

  async findBudgetPolicy(
    provider: string
  ): Promise<Pick<BudgetDefaults, 'provider' | 'maxRunCostUsd' | 'updatedAt'> | null> {
    return this.budgets.get(provider) ?? null;
  }
}

class InMemorySettingsDefaultsStore implements SettingsDefaultsStore {
  private modelRouting: ModelRoutingDefaults | null = null;
  private budget: BudgetDefaults | null = null;
  private sourcePolicy: SourcePolicyDefaults | null = null;

  async saveModelRoutingDefaults(settings: ModelRoutingDefaults): Promise<void> {
    this.modelRouting = settings;
  }

  async findModelRoutingDefaults(): Promise<ModelRoutingDefaults | null> {
    return this.modelRouting;
  }

  async saveBudgetDefaults(settings: BudgetDefaults): Promise<void> {
    this.budget = settings;
  }

  async findBudgetDefaults(): Promise<BudgetDefaults | null> {
    return this.budget;
  }

  async saveSourcePolicyDefaults(settings: SourcePolicyDefaults): Promise<void> {
    this.sourcePolicy = settings;
  }

  async findSourcePolicyDefaults(): Promise<SourcePolicyDefaults | null> {
    return this.sourcePolicy;
  }
}
