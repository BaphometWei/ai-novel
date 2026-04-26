import Fastify from 'fastify';
import { registerProjectRoutes } from './routes/projects.routes';
import { registerWorkbenchRoutes } from './routes/workbench.routes';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({
    ok: true,
    service: 'ai-novel-api'
  }));

  registerProjectRoutes(app);
  registerWorkbenchRoutes(app);

  return app;
}
