import { useCallback, useMemo, useState } from 'react';
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
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const handleProjectLoaded = useCallback((project: { id: string } | null) => {
    setSelectedProjectId(project?.id ?? '');
  }, []);

  return (
    <AppShell>
      <ProjectDashboard client={client} onProjectLoaded={handleProjectLoaded} />
      <ManuscriptEditor client={client} />
      <StoryBible />
      <ReviewCenter />
      <SerializationDesk />
      <KnowledgeLibrary />
      <ObservabilityDashboard client={client} />
      <AgentRoom client={client} />
      <VersionHistoryPanel client={client} projectId={selectedProjectId} />
      <ReviewLearningPanel client={client} />
      <NarrativeIntelligencePanel client={client} projectId={selectedProjectId} />
      <GovernanceAuditPanel client={client} projectId={selectedProjectId} />
      <RetrievalEvaluationPanel client={client} projectId={selectedProjectId} />
      <BranchRetconPanel client={client} projectId={selectedProjectId} />
      <ScheduledBackupPanel client={client} />
      <ImportExportBackupPanel client={client} projectId={selectedProjectId} />
      <SettingsPanel client={client} />
      <DecisionQueuePanel client={client} projectId={selectedProjectId} />
    </AppShell>
  );
}
