import { AppShell } from './components/AppShell';
import { DecisionQueuePanel } from './components/DecisionQueuePanel';
import { ProjectDashboard } from './components/ProjectDashboard';
import './styles.css';

export function App() {
  return (
    <AppShell>
      <ProjectDashboard />
      <DecisionQueuePanel />
    </AppShell>
  );
}
