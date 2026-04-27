import Fastify from 'fastify';
import { registerAgentRunRoutes, type AgentRunRouteStores } from './routes/agent-runs.routes';
import { registerOrchestrationRoutes } from './routes/orchestration.routes';
import { registerProjectRoutes } from './routes/projects.routes';
import { createInMemoryWorkbenchStores, registerWorkbenchRoutes, type WorkbenchRouteStores } from './routes/workbench.routes';
import { registerWorkflowRoutes, type WorkflowRouteStores } from './routes/workflow.routes';
import type { AgentOrchestrationService } from './services/agent-orchestration.service';
import { ProjectService, type ProjectServiceLike } from './services/project.service';

export interface BuildAppOptions {
  agentRuns?: AgentRunRouteStores;
  orchestration?: AgentOrchestrationService;
  projectService?: ProjectServiceLike;
  workbench?: WorkbenchRouteStores;
  workflow?: WorkflowRouteStores;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });
  const projectService = options.projectService ?? new ProjectService();

  app.get('/health', async () => ({
    ok: true,
    service: 'ai-novel-api'
  }));

  registerProjectRoutes(app, projectService);
  registerAgentRunRoutes(app, options.agentRuns);
  if (options.orchestration) {
    registerOrchestrationRoutes(app, options.orchestration);
  }
  registerWorkbenchRoutes(app, options.workbench ?? createInMemoryWorkbenchStores(projectService));
  registerWorkflowRoutes(app, options.workflow);

  return app;
}
