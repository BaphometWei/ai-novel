import { useMemo } from 'react';
import { createApiClient, type FetchImpl } from './api/client';
import { AgentRoom } from './components/AgentRoom';
import { AppShell } from './components/AppShell';
import { BranchRetconPanel } from './components/BranchRetconPanel';
import { DecisionQueuePanel } from './components/DecisionQueuePanel';
import { ImportExportBackupPanel } from './components/ImportExportBackupPanel';
import { GovernanceAuditPanel } from './components/GovernanceAuditPanel';
import { KnowledgeLibrary } from './components/KnowledgeLibrary';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import { NarrativeIntelligencePanel } from './components/NarrativeIntelligencePanel';
import { ObservabilityDashboard } from './components/ObservabilityDashboard';
import { ProjectDashboard } from './components/ProjectDashboard';
import { RetrievalEvaluationPanel } from './components/RetrievalEvaluationPanel';
import { ReviewLearningPanel } from './components/ReviewLearningPanel';
import { ReviewCenter } from './components/ReviewCenter';
import { SerializationDesk } from './components/SerializationDesk';
import { SettingsPanel } from './components/SettingsPanel';
import { ScheduledBackupPanel } from './components/ScheduledBackupPanel';
import { StoryBible } from './components/StoryBible';
import { VersionHistoryPanel } from './components/VersionHistoryPanel';
import './styles.css';

export interface AppProps {
  apiBaseUrl?: string;
  fetchImpl?: FetchImpl;
}

export function App({ apiBaseUrl, fetchImpl }: AppProps = {}) {
  const client = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, fetchImpl }), [apiBaseUrl, fetchImpl]);

  return (
    <AppShell>
      <ProjectDashboard client={client} />
      <ManuscriptEditor client={client} />
      <StoryBible />
      <ReviewCenter />
      <SerializationDesk />
      <KnowledgeLibrary />
      <ObservabilityDashboard client={client} />
      <AgentRoom client={client} />
      <VersionHistoryPanel client={client} />
      <ReviewLearningPanel client={client} />
      <NarrativeIntelligencePanel client={client} />
      <GovernanceAuditPanel client={client} />
      <RetrievalEvaluationPanel client={client} />
      <BranchRetconPanel client={client} />
      <ScheduledBackupPanel client={client} />
      <ImportExportBackupPanel client={client} />
      <SettingsPanel client={client} />
      <DecisionQueuePanel />
    </AppShell>
  );
}
