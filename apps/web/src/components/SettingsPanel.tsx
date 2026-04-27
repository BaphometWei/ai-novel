import { useEffect, useMemo, useState } from 'react';
import {
  createApiClient,
  type BudgetDefaults,
  type ModelRoutingDefaults,
  type ProviderDefaults,
  type SettingsApiClient,
  type SettingsDefaults,
  type SourcePolicyDefaults
} from '../api/client';

type SettingsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; settings: SettingsDefaults };

export interface SettingsPanelProps {
  client?: SettingsApiClient;
  provider?: string;
}

export function SettingsPanel({ client, provider = 'openai' }: SettingsPanelProps) {
  const resolvedClient = useMemo(() => client ?? createApiClient(), [client]);
  const [state, setState] = useState<SettingsState>({ status: 'loading' });
  const [providerName, setProviderName] = useState(provider);
  const [providerModel, setProviderModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [savedProvider, setSavedProvider] = useState<ProviderDefaults | null>(null);
  const [modelRouting, setModelRouting] = useState({
    provider,
    draftingModel: '',
    reviewModel: '',
    embeddingModel: ''
  });
  const [budget, setBudget] = useState({
    provider,
    maxRunCostUsd: '',
    maxDailyCostUsd: '',
    maxContextTokens: ''
  });
  const [sourcePolicy, setSourcePolicy] = useState({
    allowUserSamples: false,
    allowLicensedSamples: false,
    allowPublicDomain: true,
    restrictedSourceIds: ''
  });
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingModelRouting, setSavingModelRouting] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingSourcePolicy, setSavingSourcePolicy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedModelRouting, setSavedModelRouting] = useState<ModelRoutingDefaults | null>(null);
  const [savedBudget, setSavedBudget] = useState<BudgetDefaults | null>(null);
  const [savedSourcePolicy, setSavedSourcePolicy] = useState<SourcePolicyDefaults | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const settings = await resolvedClient.loadSettingsDefaults(provider);
        if (!isMounted) return;
        setState({ status: 'loaded', settings });
        setProviderName(settings.provider.provider);
        setProviderModel(settings.provider.defaultModel);
        setModelRouting({
          provider: settings.modelRouting.provider,
          draftingModel: settings.modelRouting.draftingModel,
          reviewModel: settings.modelRouting.reviewModel,
          embeddingModel: settings.modelRouting.embeddingModel ?? ''
        });
        setBudget({
          provider: settings.budget.provider,
          maxRunCostUsd: String(settings.budget.maxRunCostUsd),
          maxDailyCostUsd: settings.budget.maxDailyCostUsd === undefined ? '' : String(settings.budget.maxDailyCostUsd),
          maxContextTokens:
            settings.budget.maxContextTokens === undefined ? '' : String(settings.budget.maxContextTokens)
        });
        setSourcePolicy({
          allowUserSamples: settings.sourcePolicy.allowUserSamples,
          allowLicensedSamples: settings.sourcePolicy.allowLicensedSamples,
          allowPublicDomain: settings.sourcePolicy.allowPublicDomain,
          restrictedSourceIds: settings.sourcePolicy.restrictedSourceIds.join(', ')
        });
      } catch (error) {
        if (isMounted) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown settings error'
          });
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [provider, resolvedClient]);

  async function saveProviderDefaults() {
    setSavingProvider(true);
    setSaveError(null);
    try {
      const saved = await resolvedClient.saveProviderDefaults(providerName, {
        model: providerModel,
        ...(apiKey.length > 0 ? { apiKey, metadata: { apiKey: '[redacted]' } } : {})
      });
      setSavedProvider(saved);
      setProviderModel(saved.defaultModel);
      setApiKey('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save provider defaults');
    } finally {
      setSavingProvider(false);
    }
  }

  async function saveModelRoutingDefaults() {
    setSavingModelRouting(true);
    setSaveError(null);
    try {
      const saved = await resolvedClient.saveModelRoutingDefaults({
        provider: modelRouting.provider,
        draftingModel: modelRouting.draftingModel,
        reviewModel: modelRouting.reviewModel,
        embeddingModel: modelRouting.embeddingModel || undefined
      });
      setSavedModelRouting(saved);
      setModelRouting({
        provider: saved.provider,
        draftingModel: saved.draftingModel,
        reviewModel: saved.reviewModel,
        embeddingModel: saved.embeddingModel ?? ''
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save model routing defaults');
    } finally {
      setSavingModelRouting(false);
    }
  }

  async function saveBudgetDefaults() {
    setSavingBudget(true);
    setSaveError(null);
    try {
      const saved = await resolvedClient.saveBudgetDefaults({
        provider: budget.provider,
        maxRunCostUsd: Number(budget.maxRunCostUsd),
        maxDailyCostUsd: optionalNumber(budget.maxDailyCostUsd),
        maxContextTokens: optionalNumber(budget.maxContextTokens)
      });
      setSavedBudget(saved);
      setBudget({
        provider: saved.provider,
        maxRunCostUsd: String(saved.maxRunCostUsd),
        maxDailyCostUsd: saved.maxDailyCostUsd === undefined ? '' : String(saved.maxDailyCostUsd),
        maxContextTokens: saved.maxContextTokens === undefined ? '' : String(saved.maxContextTokens)
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save budget defaults');
    } finally {
      setSavingBudget(false);
    }
  }

  async function saveSourcePolicyDefaults() {
    setSavingSourcePolicy(true);
    setSaveError(null);
    try {
      const saved = await resolvedClient.saveSourcePolicyDefaults({
        allowUserSamples: sourcePolicy.allowUserSamples,
        allowLicensedSamples: sourcePolicy.allowLicensedSamples,
        allowPublicDomain: sourcePolicy.allowPublicDomain,
        restrictedSourceIds: parseRestrictedSourceIds(sourcePolicy.restrictedSourceIds)
      });
      setSavedSourcePolicy(saved);
      setSourcePolicy({
        allowUserSamples: saved.allowUserSamples,
        allowLicensedSamples: saved.allowLicensedSamples,
        allowPublicDomain: saved.allowPublicDomain,
        restrictedSourceIds: saved.restrictedSourceIds.join(', ')
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save source policy defaults');
    } finally {
      setSavingSourcePolicy(false);
    }
  }

  const settings = state.status === 'loaded' ? state.settings : null;
  const providerSettings = savedProvider ?? settings?.provider ?? null;

  return (
    <section className="dashboard-panel" aria-labelledby="settings-heading">
      <header className="workspace-header">
        <p>Settings</p>
        <h2 id="settings-heading">Provider Defaults</h2>
      </header>

      {state.status === 'loading' ? <p>Loading settings...</p> : null}
      {state.status === 'error' ? (
        <section className="work-surface" aria-label="Settings error">
          <h3>Unable to load settings.</h3>
          <p>{state.message}</p>
        </section>
      ) : null}

      {settings ? (
        <>
          <section className="work-surface" aria-label="Provider defaults">
            <h3>Provider</h3>
            <label>
              Provider
              <input value={providerName} onChange={(event) => setProviderName(event.target.value)} />
            </label>
            <label>
              Default model
              <input value={providerModel} onChange={(event) => setProviderModel(event.target.value)} />
            </label>
            <label>
              Provider API key
              <input
                autoComplete="off"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <button type="button" onClick={saveProviderDefaults} disabled={savingProvider}>
              {savingProvider ? 'Saving provider defaults...' : 'Save provider defaults'}
            </button>
            {saveError ? <p role="alert">{saveError}</p> : null}
            {providerSettings ? (
              <div aria-label="Saved provider state">
                {savedProvider ? <p>Provider defaults saved.</p> : null}
                <p>{providerSettings.secretRef}</p>
                <RedactedMetadata metadata={providerSettings.redactedMetadata} />
              </div>
            ) : null}
          </section>

          <section className="work-surface" aria-label="Model routing defaults">
            <h3>Model routing</h3>
            <label>
              Drafting model
              <input
                value={modelRouting.draftingModel}
                onChange={(event) => setModelRouting({ ...modelRouting, draftingModel: event.target.value })}
              />
            </label>
            <label>
              Review model
              <input
                value={modelRouting.reviewModel}
                onChange={(event) => setModelRouting({ ...modelRouting, reviewModel: event.target.value })}
              />
            </label>
            <label>
              Embedding model
              <input
                value={modelRouting.embeddingModel}
                onChange={(event) => setModelRouting({ ...modelRouting, embeddingModel: event.target.value })}
              />
            </label>
            <button type="button" onClick={saveModelRoutingDefaults} disabled={savingModelRouting}>
              {savingModelRouting ? 'Saving model routing defaults...' : 'Save model routing defaults'}
            </button>
            {savedModelRouting ? <p>Model routing defaults saved.</p> : null}
          </section>

          <section className="work-surface" aria-label="Budget defaults">
            <h3>Budget</h3>
            <label>
              Max run cost
              <input
                inputMode="decimal"
                value={budget.maxRunCostUsd}
                onChange={(event) => setBudget({ ...budget, maxRunCostUsd: event.target.value })}
              />
            </label>
            <label>
              Max daily cost
              <input
                inputMode="decimal"
                value={budget.maxDailyCostUsd}
                onChange={(event) => setBudget({ ...budget, maxDailyCostUsd: event.target.value })}
              />
            </label>
            <label>
              Max context tokens
              <input
                inputMode="numeric"
                value={budget.maxContextTokens}
                onChange={(event) => setBudget({ ...budget, maxContextTokens: event.target.value })}
              />
            </label>
            <button type="button" onClick={saveBudgetDefaults} disabled={savingBudget}>
              {savingBudget ? 'Saving budget defaults...' : 'Save budget defaults'}
            </button>
            {savedBudget ? <p>Budget defaults saved.</p> : null}
          </section>

          <section className="work-surface" aria-label="Source policy defaults">
            <h3>Source policy</h3>
            <label>
              <input
                checked={sourcePolicy.allowUserSamples}
                onChange={(event) => setSourcePolicy({ ...sourcePolicy, allowUserSamples: event.target.checked })}
                type="checkbox"
              />
              Allow user samples
            </label>
            <label>
              <input
                checked={sourcePolicy.allowLicensedSamples}
                onChange={(event) => setSourcePolicy({ ...sourcePolicy, allowLicensedSamples: event.target.checked })}
                type="checkbox"
              />
              Allow licensed samples
            </label>
            <label>
              <input
                checked={sourcePolicy.allowPublicDomain}
                onChange={(event) => setSourcePolicy({ ...sourcePolicy, allowPublicDomain: event.target.checked })}
                type="checkbox"
              />
              Allow public domain
            </label>
            <label>
              Restricted source ids
              <input
                value={sourcePolicy.restrictedSourceIds}
                onChange={(event) => setSourcePolicy({ ...sourcePolicy, restrictedSourceIds: event.target.value })}
              />
            </label>
            <button type="button" onClick={saveSourcePolicyDefaults} disabled={savingSourcePolicy}>
              {savingSourcePolicy ? 'Saving source policy defaults...' : 'Save source policy defaults'}
            </button>
            {savedSourcePolicy ? <p>Source policy defaults saved.</p> : null}
          </section>
        </>
      ) : null}
    </section>
  );
}

function optionalNumber(value: string): number | undefined {
  return value.trim().length === 0 ? undefined : Number(value);
}

function parseRestrictedSourceIds(value: string): string[] {
  return value
    .split(',')
    .map((sourceId) => sourceId.trim())
    .filter((sourceId) => sourceId.length > 0);
}

function RedactedMetadata({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return <p>Redacted metadata: none</p>;

  return (
    <dl>
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
