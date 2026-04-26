import Fastify from 'fastify';
import { registerProjectRoutes } from './routes/projects.routes';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({
    ok: true,
    service: 'ai-novel-api'
  }));

  registerProjectRoutes(app);

  return app;
}
