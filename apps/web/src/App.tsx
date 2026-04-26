import { AppShell } from './components/AppShell';
import { DecisionQueuePanel } from './components/DecisionQueuePanel';
import { KnowledgeLibrary } from './components/KnowledgeLibrary';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ReviewCenter } from './components/ReviewCenter';
import { SerializationDesk } from './components/SerializationDesk';
import { StoryBible } from './components/StoryBible';
import './styles.css';

export function App() {
  return (
    <AppShell>
      <ProjectDashboard />
      <StoryBible />
      <ReviewCenter />
      <SerializationDesk />
      <KnowledgeLibrary />
      <DecisionQueuePanel />
    </AppShell>
  );
}
