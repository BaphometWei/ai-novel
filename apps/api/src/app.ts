import Fastify from 'fastify';
import { registerProjectRoutes } from './routes/projects.routes';
import { registerWorkbenchRoutes } from './routes/workbench.routes';
import { registerWorkflowRoutes, type WorkflowRouteStores } from './routes/workflow.routes';

export interface BuildAppOptions {
  workflow?: WorkflowRouteStores;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({
    ok: true,
    service: 'ai-novel-api'
  }));

  registerProjectRoutes(app);
  registerWorkbenchRoutes(app);
  registerWorkflowRoutes(app, options.workflow);

  return app;
}
